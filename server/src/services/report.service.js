import { Message, Report, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { idOf, isObjectId, pageParams, paginated, sameId } from '../utils/helpers.js';
import { MESSAGE_POPULATE, PUBLIC_USER_FIELDS, adminUser, publicUser, serializeAttachment, serializeMessage } from '../utils/serializers.js';
import { CONVERSATION_TYPES, MESSAGE_TYPES, NOTIFICATION_TYPES, REPORT_STATUS, REPORT_TARGETS, USER_STATUS } from '../utils/constants.js';
import { emitToAdmins } from '../sockets/emitter.js';
import { getConversationForMember } from './access.js';
import { audit } from './audit.service.js';
import { moderateMessage, setUserStatus } from './moderation.service.js';
import { notify, notifyAdmins } from './notification.service.js';

const REASON_LABELS = {
  spam: 'spam',
  harassment: 'harassment',
  hate_speech: 'hate speech',
  inappropriate_content: 'inappropriate content',
  impersonation: 'impersonation',
  other: 'another reason',
};

const ACTIVE_STATUSES = [REPORT_STATUS.OPEN, REPORT_STATUS.REVIEWING];

export function serializeReport(report) {
  const r = report;
  return {
    _id: idOf(r),
    reporter: r.reporter?.username ? publicUser(r.reporter) : { _id: idOf(r.reporter) },
    targetType: r.targetType,
    targetUser: r.targetUser?.username ? adminUser(r.targetUser) : r.targetUser ? { _id: idOf(r.targetUser) } : null,
    targetMessage: idOf(r.targetMessage),
    targetConversation: r.targetConversation?.type
      ? {
          _id: idOf(r.targetConversation),
          type: r.targetConversation.type,
          name: r.targetConversation.group?.name || null,
          memberCount: r.targetConversation.participants?.length ?? null,
        }
      : r.targetConversation
        ? { _id: idOf(r.targetConversation) }
        : null,
    reason: r.reason,
    details: r.details,
    snapshot: r.snapshot,
    status: r.status,
    resolution: r.resolution
      ? {
          action: r.resolution.action,
          note: r.resolution.note,
          resolvedBy: r.resolution.resolvedBy?.username ? publicUser(r.resolution.resolvedBy) : idOf(r.resolution.resolvedBy),
          resolvedAt: r.resolution.resolvedAt,
        }
      : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function createReport(reporter, { targetType, targetId, reason, details = '' }) {
  const doc = { reporter: reporter._id, targetType, reason, details };
  const duplicateFilter = { reporter: reporter._id, targetType, status: { $in: ACTIVE_STATUSES } };

  if (targetType === REPORT_TARGETS.USER) {
    if (sameId(targetId, reporter._id)) throw AppError.badRequest("You can't report yourself");
    const user = await User.findById(targetId);
    if (!user) throw AppError.notFound('User not found');
    doc.targetUser = user._id;
    doc.snapshot = { fullName: user.fullName, username: user.username, bio: user.bio, avatarUrl: user.avatar?.url || null };
    duplicateFilter.targetUser = user._id;
  } else if (targetType === REPORT_TARGETS.MESSAGE) {
    if (!isObjectId(targetId)) throw AppError.notFound('Message not found');
    const message = await Message.findById(targetId).populate({ path: 'sender', select: 'fullName username' });
    if (!message) throw AppError.notFound('Message not found');
    await getConversationForMember(message.conversation, reporter._id);
    if (message.type === MESSAGE_TYPES.SYSTEM) throw AppError.badRequest('System messages cannot be reported');
    if (sameId(message.sender, reporter._id)) throw AppError.badRequest("You can't report your own message");
    if (message.isDeleted) throw AppError.badRequest('This message has already been deleted');
    doc.targetMessage = message._id;
    doc.targetUser = message.sender?._id ?? null;
    doc.targetConversation = message.conversation;
    doc.snapshot = {
      content: message.content,
      attachments: message.attachments.map(serializeAttachment),
      sender: message.sender ? { _id: idOf(message.sender), fullName: message.sender.fullName, username: message.sender.username } : null,
      createdAt: message.createdAt,
      editedAt: message.editedAt,
    };
    duplicateFilter.targetMessage = message._id;
  } else {
    const conversation = await getConversationForMember(targetId, reporter._id);
    if (conversation.type !== CONVERSATION_TYPES.GROUP) {
      throw AppError.badRequest('Only group conversations can be reported. Report the user or a message instead.');
    }
    doc.targetConversation = conversation._id;
    doc.snapshot = {
      name: conversation.group.name,
      description: conversation.group.description,
      avatarUrl: conversation.group.avatar?.url || null,
      memberCount: conversation.participants.length,
    };
    duplicateFilter.targetConversation = conversation._id;
  }

  if (await Report.exists(duplicateFilter)) {
    throw AppError.conflict('You have already reported this. Our moderators are reviewing it.', undefined, 'REPORT_EXISTS');
  }

  const report = await Report.create(doc);
  await notifyAdmins({
    type: NOTIFICATION_TYPES.REPORT_NEW,
    actor: reporter._id,
    report: report._id,
    title: 'New report submitted',
    body: `${reporter.fullName} reported a ${targetType} for ${REASON_LABELS[reason]}`,
    link: `/admin/reports/${report._id}`,
  });
  emitToAdmins('admin:report', { reportId: idOf(report), targetType, reason });

  return { _id: idOf(report), status: report.status, createdAt: report.createdAt };
}

const REPORT_POPULATE = [
  { path: 'reporter', select: PUBLIC_USER_FIELDS },
  { path: 'targetUser', select: `${PUBLIC_USER_FIELDS} email isDemo settings statusReason statusChangedAt` },
  { path: 'targetConversation', select: 'type group.name participants.user' },
  { path: 'resolution.resolvedBy', select: PUBLIC_USER_FIELDS },
];

export async function listReports({ status, targetType, page, limit } = {}) {
  const params = pageParams({ page, limit }, 50);
  const filter = {};
  if (status) filter.status = status;
  if (targetType) filter.targetType = targetType;

  const [reports, total, counts] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(params.skip).limit(params.limit).populate(REPORT_POPULATE),
    Report.countDocuments(filter),
    Report.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const byStatus = Object.fromEntries(Object.values(REPORT_STATUS).map((s) => [s, 0]));
  for (const c of counts) byStatus[c._id] = c.count;
  return { ...paginated(reports.map(serializeReport), total, params), counts: byStatus };
}

/**
 * Report detail. For message reports admins see the reported message plus a few surrounding
 * messages for context — the only message content the admin area ever exposes.
 */
export async function getReport(reportId) {
  if (!isObjectId(reportId)) throw AppError.notFound('Report not found');
  const report = await Report.findById(reportId).populate(REPORT_POPULATE);
  if (!report) throw AppError.notFound('Report not found');

  let context = null;
  if (report.targetMessage) {
    const target = await Message.findById(report.targetMessage).populate(MESSAGE_POPULATE);
    if (target) {
      const [before, after] = await Promise.all([
        Message.find({ conversation: target.conversation, _id: { $lt: target._id } }).sort({ _id: -1 }).limit(5).populate(MESSAGE_POPULATE),
        Message.find({ conversation: target.conversation, _id: { $gt: target._id } }).sort({ _id: 1 }).limit(5).populate(MESSAGE_POPULATE),
      ]);
      context = {
        targetMessageId: idOf(target),
        currentState: serializeMessage(target),
        messages: [...before.reverse(), target, ...after].map(serializeMessage),
      };
    }
  }

  const targetFilter = report.targetMessage
    ? { targetMessage: report.targetMessage }
    : report.targetType === REPORT_TARGETS.USER
      ? { targetType: REPORT_TARGETS.USER, targetUser: report.targetUser?._id }
      : { targetConversation: report.targetConversation?._id };
  const relatedReports = await Report.countDocuments({ ...targetFilter, _id: { $ne: report._id } });
  const targetUserReports = report.targetUser ? await Report.countDocuments({ targetUser: report.targetUser._id }) : 0;

  return { report: serializeReport(report), context, relatedReports, targetUserReports };
}

export async function updateReport(req, reportId, { status, action = 'none', note = '' }) {
  if (!isObjectId(reportId)) throw AppError.notFound('Report not found');
  const report = await Report.findById(reportId);
  if (!report) throw AppError.notFound('Report not found');

  if (action !== 'none' && status !== REPORT_STATUS.RESOLVED) {
    throw AppError.badRequest('Taking an action resolves the report — set the status to "resolved".');
  }

  if (action === 'message_removed') {
    if (!report.targetMessage) throw AppError.badRequest('This report is not about a message');
    await moderateMessage(req, report.targetMessage, note);
  } else if (action === 'user_suspended') {
    if (!report.targetUser) throw AppError.badRequest('This report has no user to suspend');
    const target = await User.findById(report.targetUser).select('status');
    if (target && target.status !== USER_STATUS.SUSPENDED) {
      await setUserStatus(req, report.targetUser, USER_STATUS.SUSPENDED, note || `Reported for ${REASON_LABELS[report.reason]}`);
    }
  } else if (action === 'warned') {
    if (!report.targetUser) throw AppError.badRequest('This report has no user to warn');
    await notify(report.targetUser, {
      type: NOTIFICATION_TYPES.ACCOUNT,
      actor: req.user._id,
      title: 'Warning from the moderation team',
      body: note || 'Your recent activity was reported and goes against our community guidelines. Please keep conversations respectful.',
    });
  }

  report.status = status;
  if (status === REPORT_STATUS.RESOLVED || status === REPORT_STATUS.DISMISSED) {
    report.resolution = { action, note, resolvedBy: req.user._id, resolvedAt: new Date() };
  } else {
    report.resolution.note = note || report.resolution.note;
  }
  await report.save();

  await audit(req, `report.${status}`, 'report', report._id, { action, note });

  if (status === REPORT_STATUS.RESOLVED || status === REPORT_STATUS.DISMISSED) {
    await notify(report.reporter, {
      type: NOTIFICATION_TYPES.REPORT_UPDATE,
      actor: null,
      report: report._id,
      title: status === REPORT_STATUS.RESOLVED ? 'Your report was resolved' : 'Your report was reviewed',
      body:
        status === REPORT_STATUS.RESOLVED
          ? 'Thanks for helping keep the community safe — our moderators took action.'
          : 'Our moderators reviewed your report and found no violation. Thanks for letting us know.',
    });
  }

  emitToAdmins('admin:report', { reportId: idOf(report), status });
  return getReport(report._id);
}

/** Consistent success envelope: `{ success: true, data }`. */
export const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

export const noContent = (res) => res.status(204).end();

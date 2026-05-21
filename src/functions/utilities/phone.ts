export const sanitizePhoneNumber = (val: string) => {
  if (!val) return '';

  return val.replace(/\D/g, '');
};

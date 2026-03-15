import dayjs from 'dayjs';

export const createPrettyDate = (date: string | Date) => {
  return dayjs(date).format('MMM DD, YYYY');
};

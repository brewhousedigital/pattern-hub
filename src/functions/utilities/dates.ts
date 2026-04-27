import dayjs, { Dayjs } from 'dayjs';

export const createPrettyDate = (date: string | Date | Dayjs) => {
  return dayjs(date).format('MMM DD, YYYY');
};

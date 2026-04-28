import dayjs, { Dayjs } from 'dayjs';

export const createPrettyDate = (date: string | Date | Dayjs) => {
  if (!date) {
    return 'No Date Selected';
  }

  return dayjs(date).format('MMM DD, YYYY');
};

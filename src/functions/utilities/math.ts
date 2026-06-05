export const mathClamp = (number: number, lower: number, upper: number) => {
  number = Math.max(number, lower);
  number = number > upper ? upper : number;

  return number;
};

export const formatByteSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} kb`;
  }
  return `${Math.round(bytes / (1024 * 1024))} mb`;
};

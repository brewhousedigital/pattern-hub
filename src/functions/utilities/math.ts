export const mathClamp = (number: number, lower: number, upper: number) => {
  number = Math.max(number, lower);
  number = number > upper ? upper : number;

  return number;
};

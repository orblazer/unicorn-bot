export const pad = (number: number): string => {
  return (number < 10) ? '0' + number : String(number)
}

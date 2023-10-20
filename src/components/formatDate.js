export function formatDate(date) {
  if(!isDate(date)) return date;
  return new Intl.DateTimeFormat('default', {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(date))
}

export function isDate(date) {
  if(!date) return false;
  return new Date(date).getTime() === new Date(date).getTime();
}
export const secondToDate = (time: number) => {
  if (time === 0) {
    return '0 seconde'
  }

  // Get years
  const years = Math.floor(time / 31104000)
  if (years > 0) {
    time -= years * 31104000
  }

  // Get days
  const days = Math.floor(time / 86400)
  if (days > 0) {
    time -= days * 86400
  }

  // Get hours
  const hours = Math.floor(time / 3600)
  if (hours > 0) {
    time -= hours * 3600
  }

  // Get minutes
  const minutes = Math.floor(time / 60)
  if (minutes > 0) {
    time -= minutes * 60
  }

  // Get seconds
  const seconds = Math.floor(time)
  time -= seconds

  let timeStr = []

  // Format date
  if (years > 0) {
    if (years === 1) {
      timeStr.push(years + ' an')
    }
    else {
      timeStr.push(years + ' ans')
    }
  }

  if (days > 0) {
    if (days === 1) {
      timeStr.push(days + ' jour')
    }
    else {
      timeStr.push(days + ' jours')
    }
  }

  if (hours > 0) {
    if (hours === 1) {
      timeStr.push(hours + ' heure')
    }
    else {
      timeStr.push(hours + ' heures')
    }
  }

  if (minutes > 0) {
    if (minutes === 1) {
      timeStr.push(minutes + ' minute')
    }
    else {
      timeStr.push(minutes + ' minutes')
    }
  }

  if (seconds > 0) {
    if (seconds === 1) {
      timeStr.push(seconds + ' seconde')
    }
    else {
      timeStr.push(seconds + ' secondes')
    }
  }

  return timeStr.join(', ').replace(/, (.*)$/, ' et $1')
}

function replaceLast (string: string, what: string, replacement: string) {
  return string.split(' ').reverse().join(' ').replace(new RegExp(what), replacement).split(' ').reverse().join(' ');
}

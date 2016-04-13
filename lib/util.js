/* global __ */

exports.epochToTimeFormatter = function (epoch) {
  if (epoch == null) {
    epoch = new Date().getTime()
  }
  return (new Date(epoch)).toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, '$1')
}

exports.createAddressSpeech = function (place, city) {
  if (place && city) {
    return place + __('speech.placeCityConjunction') + city
  } else if (city) {
    return city
  } else if (place) {
    return place
  }
  return __('speech.positionUnknown')
}

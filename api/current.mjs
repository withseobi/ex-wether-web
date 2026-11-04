import { handleWeatherRequest } from '../lib/weather.mjs';

export default {
  fetch(request) {
    return handleWeatherRequest(request);
  }
};

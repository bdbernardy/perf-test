const { locales } = require("./constants");

module.exports.definedLuaScripts = function (redis) {
  redis.defineCommand("countryRoutes", {
    numberOfKeys: 1,
    lua: `local k = redis.call('get',KEYS[1])
    return redis.call('get', k)`,
  });
}

module.exports.getRouteData = async function (redis, origin, destination) {
  const pipeline = await redis.pipeline();

  for (let locale of locales) {
    pipeline.sismember(`sitemap-routes:${locale}`, `${origin}/${destination}`);
  }

  const result = await pipeline
    .get(`city:routes:${origin}}`) // Origin routes
    .get(`city:routes:${destination}}`) // Destination routes
    .get(`city:stations:${origin}`) // Origin stations
    .get(`city:stations:${destination}`) // Destination stations
    .countryRoutes(`city:country-key:${origin}`) // Country routes
    .exec();

  let localeStatuses = [];
  for (let i = 0; i < locales.length; i++) {
    const [, status] = result[i];
    localeStatuses.push({
      locale: locales[i],
      status
    });
  }

  const [, originPopularRoutesData] = result[locales.length];
  const originPopularRoutes = JSON.parse(originPopularRoutesData);

  const [, destinationPopularRoutesData] = result[locales.length + 1];
  const destinationPopularRoutes = JSON.parse(destinationPopularRoutesData);

  const [, originStationsData] = result[locales.length + 2];
  const [, destinationStationsData] = result[locales.length + 3];

  const [, countryPopularRoutesData] = result[locales.length + 4];
  const popularCountryRoutes = JSON.parse(countryPopularRoutesData);

  return {
    originGeohash: origin,
    destinationGeohash: destination,
    localeStatuses,
    originPopularRoutes,
    destinationPopularRoutes,
    popularStations: {
      origin: JSON.parse(originStationsData),
      destination: JSON.parse(destinationStationsData)
    },
    popularCountryRoutes
  };
}
const Redis = require("ioredis");
const { MongoClient } = require("mongodb");
const { locales, numberOfCities, countries } = require('./constants');
const { definedLuaScripts, getRouteData } = require("./redis");
const fs = require('fs').promises;
const path = require('path');

function createRandomGeohash() {
  const padding = Math.random() > 0.5 ? 'a' : 'b';
  const index = Math.floor((Math.random() * 1000) + 1);

  return createGeohash(index, padding);
}

function createRandomCountry() {
  const index = Math.floor((Math.random() * 6));

  return countries[index];
}

function createGeohash(index, padding) {
  return String(index).padStart(6, padding)
}

function createRandomPopularRoutes() {
  return Array(15).fill({}).map(_ => ({
    originGeohash: createRandomGeohash(),
    origin: 'Paris',
    destinationGeohash: createRandomGeohash(),
    destination: 'Versaille'
  }));
}

async function exists(path) {
  try {
    await fs.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function seedRedisCities(redis, padding) {
  for (let i = 1; i <= numberOfCities; i++) {
    const geohash = createGeohash(i, padding);

    // Create popular routes (these are dummy routes for perf tests)
    const popularRoutes = {
      from: createRandomPopularRoutes(),
      to: createRandomPopularRoutes()
    }
    await redis.set(`city:routes:${geohash}}`, JSON.stringify(popularRoutes));

    // Create origin popular stations
    const popularStations = {
      city_geohash: geohash,
      vehicle_type: 'bus',
      locations: Array(15).fill({
        id: 12345,
        name: "Grand Central Station",
        address: ["Busbus Office", "Montreal", "12345", "Quebec", "Canada"],
        type: "bus station",
        latitude: 15.4444,
        longitude: 13.22222,
        geohash: "xxxyyyzzz",
        total: 27
      })
    }
    await redis.set(`city:stations:${geohash}`, JSON.stringify(popularStations));

    // Add city country
    const country = createRandomCountry();
    await redis.set(`city:country-key:${geohash}`, `country:routes:${country}`);
  }
}

async function seedRedisRouteStatusCache(redis) {
  for (let i = 1; i <= numberOfCities; i++) {
    for (let j = 1; j <= numberOfCities; j++) {
      for (let locale of locales) {
        const origin = createGeohash(i, 'a');
        const destination = createGeohash(j, 'b');
        await redis.sadd(`sitemap-routes:${locale}`, `${origin}/${destination}`)
      }
    }
  }
}

async function seedCountryPopularRoutes(redis) {
  for (let country of countries) {
    const popularRoutes = createRandomPopularRoutes();
    await redis.set(`country:routes:${country}`, JSON.stringify(popularRoutes));
  }
}

async function seedRedis() {
  const redis = new Redis();

  await seedRedisCities(redis, 'a');
  await seedRedisCities(redis, 'b');
  await seedRedisRouteStatusCache(redis); // Create 200/404 cache by locale
  await seedCountryPopularRoutes(redis); // Popular routes by country

  redis.disconnect();
}

async function seedMongoDb() {
  const redis = new Redis();
  definedLuaScripts(redis);

  const uri = "mongodb://localhost:27017";
  const client = new MongoClient(uri);

  await client.connect();
  const collection = client.db("landingPages").collection("routes");

  for (let i = 1; i <= numberOfCities; i++) {
    let routes = [];
    for (let j = 1; j <= numberOfCities; j++) {
      const origin = createGeohash(i, 'a');
      const destination = createGeohash(j, 'b');

      const routeData = await getRouteData(redis, origin, destination);
      routeData._id = `${origin}/${destination}`;

      routes.push(routeData);
    }

    collection.insertMany(routes);
    routes = [];
  }

  redis.disconnect();
  await client.close();
}

async function seedFiles() {
  const uri = "mongodb://localhost:27017";
  const client = new MongoClient(uri);

  await client.connect();
  const collection = client.db("landingPages").collection("routes");

  const stream = collection.find().stream();

  for await (const route of stream) {
    const folderPath = path.join('data', route.originGeohash);
    const filePath = path.join(folderPath, route.destinationGeohash);

    if (!(await exists(folderPath))) {
      await fs.mkdir(folderPath);
    }

    await fs.writeFile(filePath, JSON.stringify(route), "utf-8");
  }

  await client.close();
}

async function seed() {
  await seedRedis();
  await seedMongoDb();
  await seedFiles();
}

seed();

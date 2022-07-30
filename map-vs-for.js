const { MongoClient } = require("mongodb");

const fastify = require('fastify');
const cluster = require("cluster");

const USE_FASTIFY = true;

const app = fastify();
const port = 3000;
const numberOfClusters = 6;

async function start() {
  if (cluster.isMaster) {
    for (let i = 0; i < numberOfClusters; i++) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
      console.log(`worker ${worker.process.pid} died`);
      console.log("Let's fork another worker!");
      cluster.fork();
    });
  } else {
    const uri = "mongodb://localhost:27017?maxPoolSize=5";
    const client = new MongoClient(uri);

    await client.connect();
    const collection = client.db("landingPages").collection("routes");

    app.get('/map/:origin/:destination', async (req, res) => {
      const { origin, destination } = req.params;
      const _id = `${origin}/${destination}`;
      const data = await collection.findOne({ _id });

      const countryRoutes = data.popularCountryRoutes.map(route => ({
        origin: {
          geohash: route.originGeohash,
          name: route.origin
        },
        destination: {
          geohash: route.destinationGeohash,
          name: route.destination
        },
        route_type: "route"
      }));

      return USE_FASTIFY ? countryRoutes : res.json(countryRoutes);
    });

    app.get('/for/:origin/:destination', async (req, res) => {
      const { origin, destination } = req.params;
      const _id = `${origin}/${destination}`;
      const data = await collection.findOne({ _id });

      const countryRoutes = [];

      for (let i = 0; i < data.popularCountryRoutes.length; i++) {
        countryRoutes.push({
          origin: {
            geohash: data.popularCountryRoutes[i].originGeohash,
            name: data.popularCountryRoutes[i].origin
          },
          destination: {
            geohash: data.popularCountryRoutes[i].destinationGeohash,
            name: data.popularCountryRoutes[i].destination
          },
          route_type: "route"
        });
      }

      return USE_FASTIFY ? countryRoutes : res.json(countryRoutes);
    });

    app.get('/for-of/:origin/:destination', async (req, res) => {
      const { origin, destination } = req.params;
      const _id = `${origin}/${destination}`;
      const data = await collection.findOne({ _id });

      const countryRoutes = [];

      for (const route of data.popularCountryRoutes) {
        countryRoutes.push({
          origin: {
            geohash: route.originGeohash,
            name: route.origin
          },
          destination: {
            geohash: route.destinationGeohash,
            name: route.destination
          },
          route_type: "route"
        });
      }

      return countryRoutes;
    });

    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });
  }
}

start();
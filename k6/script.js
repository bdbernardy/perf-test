import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1s', target: 10 },
    { duration: '1s', target: 20 },
    { duration: '1s', target: 40 },
    { duration: '1s', target: 80 },
    { duration: '1s', target: 120 },
    { duration: '5s', target: 200 },
    { duration: '20s', target: 240 }
  ],
};

function createGeohash(index, padding) {
  return String(index).padStart(6, padding)
}

function createRandomGeohash(padding) {
  const index = Math.floor((Math.random() * 1000) + 1);

  return createGeohash(index, padding);
}

export default function () {
  const origin = createRandomGeohash('a');
  const destination = createRandomGeohash('b');
  http.get(`http://localhost:3000/redis/${origin}/${destination}`, { tags: 'redis' });
  // http.get(`http://localhost:3000/mongo/${origin}/${destination}`, { tags: 'mongo' });
  // http.get(`http://localhost:3002/routes/${origin}/${destination}`, { tags: 'nginx' });
}

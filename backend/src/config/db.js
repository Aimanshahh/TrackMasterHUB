import mongoose from 'mongoose';

const state = {
  connection: null,
  promise: null,
};

// The connection URI is provided by the server when it initializes.
let dbUri = '';

function setMongoUri(uri) {
  dbUri = uri;
}

async function connectDatabase() {
  if (state.connection && state.connection.readyState === 1) {
    return state.connection;
  }

  if (state.promise) {
    return state.promise;
  }

  if (!dbUri) {
    throw new Error('MongoDB URI not set. Call setMongoUri() before connectDatabase().');
  }

  state.promise = mongoose.connect(dbUri, {
    maxPoolSize: 20,
    socketTimeoutMS: 30000,
    serverSelectionTimeoutMS: 10000,
  }).then(() => {
    state.connection = mongoose.connection;
    return state.connection;
  }).catch(async (error) => {
    state.connection = null;
    state.promise = null;
    throw error;
  });

  return state.promise;
}

async function disconnectDatabase() {
  if (!state.connection) return;
  await state.connection.disconnect();
  state.connection = null;
  state.promise = null;
}

function getConnection() {
  return state.connection;
}

function isConnected() {
  return state.connection?.readyState === 1;
}

function connectionToJson() {
  if (!state.connection) {
    return { status: 'disconnected' };
  }

  return {
    status: 'operational',
    database: state.connection.name,
    host: state.connection.host,
    ready: state.connection.readyState === 1,
    buffers: state.connection.buffers,
  };
}

// Export the mongoose instance for model registration
export default mongoose;

export {
  connectDatabase,
  disconnectDatabase,
  getConnection,
  isConnected,
  connectionToJson,
  setMongoUri,
};

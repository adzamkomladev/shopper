// A till host that dies before it is ready, the way a real one does when a dependency throws: it reports an error
// whose text carries the device token, the database key and a customer's phone, then exits non-zero.
process.on("message", (message) => {
  const { deviceToken, databaseKey } = message.config;
  process.send(
    {
      type: "error",
      code: "HOST_UNAVAILABLE",
      message: `boom ${deviceToken} key ${databaseKey} calling 0244123456`,
    },
    () => process.exit(1),
  );
});

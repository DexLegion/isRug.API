const grpc = require("@grpc/grpc-js");
const loader = require("@grpc/proto-loader");
(async () => {
  let pkg = loader.loadSync("./txpool.proto", { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
  //@ts-ignore
  const txnpool = grpc.loadPackageDefinition(pkg).v1;

  //@ts-ignore
  let mon = new txnpool.TxnPoolOperator("localhost:9632", grpc.credentials.createInsecure());
  let sub = mon.Subscribe({ types: [0, 1, 2, 3, 4, 5, 6] }, (x) => console.log(x));
  console.log(sub);
  sub.on("data", (x) => console.log(x));
})();

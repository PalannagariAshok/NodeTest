//Packages
const express = require("express");
const helmet = require("helmet");
const asyncio = require("async");
const MongoClient = require("mongodb").MongoClient;
//Config file
const config = require("./config.json");
//Initialize app
const app = express();
//Application Accessories
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//Port Configuration
const port = config.port;
//MongoClient Connection
const client = new MongoClient(config.mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
//Databasee Connection
const db = new Promise((res, rej) => {
    client
        .connect()
        .then(c => {
            console.log("Connected to Database");
            database = c.db(config.dbName);
            res(database);
        })
        .catch(e => {
            console.log("Database Client Connection Error");
            rej(e);
        });
});
function compare(a, b) {
  const bandA = a.uC.toUpperCase();
  const bandB = b.uC.toUpperCase();

  let comparison = 0;
  if (bandA > bandB) {
    comparison = 1;
  } else if (bandA < bandB) {
    comparison = -1;
  }
  return comparison;
}
//Collection of Updated Data, Can be improved**
function collectiveData(returnObject) {
    db.then(database => {
        let sendObj = [];
        database
            .collection("entities")
            .find({})
            .toArray((err, docs) => {
                if (err) throw err;
                else {
                    //console.log(docs);
                    asyncio.each(
                        docs,
                        function(doc, callback) {
                            let tempObj = {};
			    tempObj["arrived"] = {};
                            tempObj["coming"] = {};
                            //console.log(doc);
                            tempObj["uC"] = doc.uC;
                            asyncio.series(
                                [
                                    function(cb) {                                        
                                        database
                                            .collection("guests")
                                            .find({
                                                eID: doc.eID,
                                                gID: 1,
                                                a3: true
                                            })
                                            .count()
                                            .then(res => {
                                                tempObj["arrived"]["f"] = res;
                                                cb(null, true);
                                            })
                                            .catch(e => {
                                                console.log(
                                                    "Guest Find Count Error 1",
                                                    e
                                                );
                                                cb(null, false);
                                            });
                                    },
                                    function(cb) {
                                        database
                                            .collection("guests")
                                            .find({
                                                eID: doc.eID,
                                                gID: 2,
                                                a3: true
                                            })
                                            .count()
                                            .then(res => {
                                                tempObj["arrived"]["m"] = res;
                                                cb(null, true);
                                            })
                                            .catch(e => {
                                                console.log(
                                                    "Guest Find Count Error 2",
                                                    e
                                                );
                                                cb(null, false);
                                            });
                                    },
                                    function(cb) {                                        
                                        database
                                            .collection("guests")
                                            .find({
                                                eID: doc.eID,
                                                gID: 1,
                                                a3: false
                                            })
                                            .count()
                                            .then(res => {
                                                tempObj["coming"]["f"] = res;
                                                cb(null, true);
                                            })
                                            .catch(e => {
                                                console.log(
                                                    "Guest Find Count Error 3",
                                                    e
                                                );
                                                cb(null, false);
                                            });
                                    },
                                    function(cb) {
                                        database
                                            .collection("guests")
                                            .find({
                                                eID: doc.eID,
                                                gID: 2,
                                                a3: false
                                            })
                                            .count()
                                            .then(res => {
                                                tempObj["coming"]["m"] = res;
                                                cb(null, true);
                                            })
                                            .catch(e => {
                                                console.log(
                                                    "Guest Find Count Error 4",
                                                    e
                                                );
                                                cb(null, false);
                                            });
                                    }
                                ],
                                function(err, results) {
				    //console.log(tempObj);
                                    sendObj.push(tempObj);
                                    callback();
                                }
                            );
                        },
                        function(err) {
                            //console.log(sendObj);
                            returnObject(sendObj);
                        }
                    );
                }
            });
    }).catch(e => {
        console.log(e);
        returnObject({ message: "Error" });
    });
}

app.post("/", (req, res) => {
    console.log(req.body);
    if (req.body.token === "init") {
        collectiveData(rO => {
            let sendObj = {
                message: `Successfully Connected to Database.`,
                data: rO
            }
	    sendObj.data.sort(compare)
            //console.log("Sent Obj", sendObj)
            res.send(sendObj);
        });
    } else {
        if (req.body.time) {
            db.then(database => {
                database
                    .collection("guests")
                    .findOneAndUpdate(
                        { uID: +req.body.token },
                        { $set: { time: req.body.time, a3: true } }
                    )
                    .then(result => {
                        console.log("value", result.value.a3);
                        database
                            .collection("entities")
                            .findOne({ eID: result.value.eID })
                            .then(entity => {
				if(result.value.a3){
					collectiveData(rO => {
					        let sendObj = {
					            message: `${result.value.name} from ${entity.uC} has alredy arrived.`,
					            data: rO,
						    exist:"yellow"
					        }
						sendObj.data.sort(compare)
					        //console.log("Sent Obj", sendObj)
					        res.send(sendObj);
					    });  
				}
				else {
				collectiveData(rO => {
			                let sendObj = {
			                    message: `${result.value.name} from ${entity.uC} has arrived.`,
			                    data: rO,
					    exist:"green",
			                }
					sendObj.data.sort(compare)
			                //console.log("Sent Obj", sendObj)
			                res.send(sendObj);
			            });  
				}                                                            
                            })
                            .catch(e => {
                                console.log("Collection Find One Error", e);
                                res.send({
                                    message: "Person not in Database."
                                });
                            });
                    })
                    .catch(e => {
			res.send({ message: "Person not in Database.",exist:"red", });
                        console.log("Collection Find One And Update Error message", e);
                        
                    });
            }).catch(e => {
                console.log("Database Error\n", e);
                res.send({ message: "Network Error." });
            });
        } else res.send({ message: "Network Error" });
    }
});

app.listen(port, () => console.log(`Application listening on port ${port}!`));

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("./dbConnectExec.js");
const montgomeryConfig = require("./config.js");
const auth = require("./middleware/authenticate");

const app = express();
app.use(express.json());

//azurewebsite.net, colostate.edu
app.use(cors());

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`app is running on port ${PORT}`);
});

app.get("/hi", (req, res) => {
  res.send("hello world");
});

app.get("/", (req, res) => {
  res.send("API is running");
});

app.post("/rating", auth, async (req, res) => {
  try {
    let artFK = req.body.artFK;
    let review = req.body.review;
    let passFail = req.body.passFail;

    passFailBoolean = passFail.toLowerCase();

    if (passFailBoolean === "pass") {
      passFailBoolean = true;
    } else if (passFailBoolean === "fail") {
      passFailBoolean = false;
    } else {
      return res.status(400).send("bad request");
    }

    if (!artFK || !review || !passFail) {
      return res.status(400).send("bad request");
    }

    review = review.replace("'", "''");

    let insertQuery = `INSERT INTO Rating(PassFail, Review, ArtFK, ContactFK)
    OUTPUT inserted.RatingPK, inserted.PassFail, inserted.Review, inserted.ArtFK
    VALUES('${passFailBoolean}', '${review}', '${artFK}', ${req.contact.ContactPK})`;

    let insertedRating = await db.executeQuery(insertQuery);
    res.status(201).send(insertedRating[0]);
  } catch (err) {
    console.log("error in POST /rating", err);
    res.status(500).send();
  }
});

app.get("/contacts/me", auth, (req, res) => {
  res.send(req.contact);
});

app.post("/contacts/login", async (req, res) => {
  let email = req.body.email;
  let password = req.body.password;

  if (!email || !password) {
    return res.status(400).send("Bad request");
  }

  let query = `SELECT *
  FROM Contact
  WHERE Email = '${email}'`;

  let result;
  try {
    result = await db.executeQuery(query);
  } catch (myError) {
    console.log("error in /contacts/login", myError);
    return res.status(500).send();
  }

  if (!result[0]) {
    return res.status(401).send("Invalid user credentials");
  }

  //3. CHECK PASSWORD   ----->> !!!Always returns invalid!!! <<-----

  let user = result[0];

  if (!bcrypt.compareSync(password, user.Password)) {
    console.log("invalid password");
    return res.status(401).send("Invalid user credentials");
  }

  //4. GENERATE TOKEN

  let token = jwt.sign({ pk: user.ContactPK }, montgomeryConfig.JWT, {
    expiresIn: "60 minutes",
  });
  console.log("token", token);

  //5. SAVE TOKEN IN DB AND SEND RESPONSE

  let setTokenQuery = `UPDATE Contact
  SET Token = '${token}'
  WHERE ContactPK = ${user.ContactPK}`;

  try {
    await db.executeQuery(setTokenQuery);

    res.status(200).send({
      token: token,
      user: {
        NameFirst: user.NameFirst,
        NameLast: user.NameLast,
        Email: user.Email,
        ContactPK: user.ContactPK,
      },
    });
  } catch (myError) {
    console.log("error in setting user token", myError);
    res.status(500).send();
  }
});

app.post("/contacts", async (req, res) => {
  let nameFirst = req.body.nameFirst;
  let nameLast = req.body.nameLast;
  let email = req.body.email;
  let password = req.body.password;

  if (!nameFirst || !nameLast || !email || !password) {
    return res.status(400).send("Bad request");
  }

  nameFirst = nameFirst.replace("'", "''");
  nameLast = nameLast.replace("'", "''");

  let emailCheckQuery = `SELECT email
  FROM Contact
  WHERE Email = '${email}'`;

  let existingUser = await db.executeQuery(emailCheckQuery);

  if (existingUser[0]) {
    return res.status(409).send("Duplicate email");
  }

  let hashedPassword = bcrypt.hashSync(password);

  let insertQuery = `INSERT INTO Contact(NameFirst, NameLast, Email, Password)
  VALUES('${nameFirst}', '${nameLast}', '${email}', '${hashedPassword}')`;

  db.executeQuery(insertQuery)
    .then(() => {
      res.status(201).sendStatus();
    })
    .catch((err) => {
      console.log("error in POST /contact", err);
      res.status(500).send();
    });
});

app.get("/art", (req, res) => {
  db.executeQuery(
    `SELECT *
    FROM Art
    LEFT JOIN Artist
    ON Artist.ArtistPK = Art.ArtistFK`
  )
    .then((theResults) => {
      res.status(200).send(theResults);
    })
    .catch((myError) => {
      console.log(myError);
      res.status(500).send();
    });
});

app.get("/art/:pk", (req, res) => {
  let pk = req.params.pk;
  // console.log(pk);
  let myQuery = `SELECT *
  FROM Art
  LEFT JOIN Artist
  ON Artist.ArtistPK = Art.ArtistFK
  WHERE ArtPK = ${pk}`;

  db.executeQuery(myQuery)
    .then((result) => {
      // console.log("result", result);
      if (result[0]) {
        res.send(result[0]);
      } else {
        res.status(404).send(`bad request`);
      }
    })
    .catch((err) => {
      console.log("Error in /art/:pk", err);
      res.status(500).send();
    });
});

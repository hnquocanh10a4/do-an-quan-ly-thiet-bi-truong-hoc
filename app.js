//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require('mongoose-findorcreate');
const GoogleStrategy = require('passport-google-oauth20').Strategy;


const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public"));

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true
}))

app.use(passport.initialize());
app.use(passport.session());

//--------Database-----------------------------------------------------------
mongoose.connect("mongodb://localhost:27017/EquipmentDB", { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.set('useCreateIndex', true);

mongoose.set('useFindAndModify', false);

const equipmentSchema = mongoose.Schema({
  name: {
    type: String,
    minLength: 1,
    trim: true
  },
  max: {
    type: Number,
    min: 1,
    max: 10000
  },
  cost: {
    type: Number,
    min: 0
  },
  count: String
});

const Equipment = mongoose.model("Equipment", equipmentSchema);


const userSchema = new mongoose.Schema({
  username: {
    type: String,
    minLength: 1,
  },
  password: {
    type: String,
    minLength: 6,
  },
  googleID: String
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);



passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});




const loanSchema = mongoose.Schema({
  MSSV: {
    type: String,
    minLength: 1,
    maxLength: 11,
    trim: true
  },
  studentName: {
    type: String,
    minLength: 1,
    trim: true
  },
  phone: {
    type: String,
    minLength: 1,
    maxLength: 14,
    trim: true
  },
  roomName: {
    type: String,
    minLength: 1,
    trim: true
  },
  note: {
    type: String,
    trim: true
  },
  day: Date,
  equipmentList: [equipmentSchema]
});
const Loan = mongoose.model("Loan", loanSchema);


const loanHistorySchema = new mongoose.Schema({
  username: {
    type: String,
    minLength: 1,
  },
  add: [loanSchema],
  edit: [loanSchema],
  delete: [loanSchema]
});
const LoanHistory = mongoose.model("LoanHistory", loanHistorySchema);


const loanOnlineSchema = new mongoose.Schema({
  email: String,
  borrowOn: loanSchema
});
const LoanOnline = mongoose.model("LoanOnline", loanOnlineSchema);


const staffSchema = new mongoose.Schema({
  user: userSchema,
  MSNV: {
    type: String,
    minLength: 1,
    trim: true
  },
  staffName: {
    type: String,
    minLength: 1,
    trim: true
  },
  address: {
    type: String,
    minLength: 1,
    trim: true
  },
  sex: String,
  age: {
    type: Number,
    min: 18,
    max: 40
  }
});




const Staff = mongoose.model("Staff", staffSchema);



const adminSchema = new mongoose.Schema({
  user: userSchema,
  name: {
    type: String,
    minLength: 1,
    trim: true
  },
  listStaff: [staffSchema]
});


const Admin = mongoose.model("Admin", adminSchema);
//-----------Set admin
// User.register({username: "admin"}, "quocanh001", function(err, user){
//   if (err) {
//     console.log(err);
//   } else {
//     passport.authenticate("local")(req, res, function(){
//       console.log("sussecful");
//     });
//   }
// });



// User.findOne({username: "admin"}, function(err, result){
// const admin1 = new Admin({
//   name:"thay Hanh",
//   user : result
// });
// admin1.save();

// })


//--------Login-----------------------------------------------------------
passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/equipment",
  // userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
  function (accessToken, refreshToken, profile, cb) {
    console.log(profile);

    User.findOrCreate({ username: profile.emails[0].value, googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

//------------------------------------------------------------------------

var messageLogin = "";
app.get("/", function (req, res) {
  res.render("login", { messageLogin: messageLogin });
  messageLogin = "Sai tên đăng nhập hoặc mật khẩu";

});
// >> reder trang dang nhap

//////get google account 
app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile", "email"] })
);

app.get("/auth/google/equipment",
  passport.authenticate('google', { failureRedirect: "/" }),
  function (req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/studentBorrowOnline");
  });
//Capitalize first letter in word
function titleCase(str) {
  var splitStr = str.toLowerCase().split(' ');
  for (var i = 0; i < splitStr.length; i++) {
      // You do not need to check if i is larger than splitStr length, as your for does that for you
      // Assign it back to the array
      splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);     
  }
  // Directly return the joined string
  return splitStr.join(' '); 
}

//////----------------Borrow Online

app.get("/studentBorrowOnline", function (req, res) {
  if (req.isAuthenticated()) {
    errMSSV = "";
    errPhone = "";
    errEquipment = "";
    errRoom = "";
    errFullName = "";
    Equipment.find({}, function (err, result) {
      if (!err) {
        res.render("studentBorrowOnline",
          {
            loanHome: result,
            errMSSV: errMSSV,
            errPhone: errPhone,
            errFullName: errFullName,
            errEquipment: errEquipment
          });
      }
    });
  }
  else {
    res.redirect("/");
  }
});
var maSVForTrans = "";
app.post("/studentBorrowOnline", function (req, res) {
  var MaSV = req.body.mssv;
  var name = req.body.name;
  var phone = req.body.phone;
  var roomName = req.body.roomName;
  var note = req.body.note;
  var selected = req.body.select;
  maSVForTrans = req.body.mssv;
  name = titleCase(name);
  name = name.trim();

  Loan.find({}, function (err, resultAll) {
    Loan.findOne({ MSSV: MaSV }, function (err, result) {
      Equipment.findOne({ name: selected }, function (err, resultOneE) {
        if (result) {
          errMSSV = "Mã sinh viên đang mượn";

        }
        else if(checkMSSV(MaSV)=== false)
        {
          errMSSV = "Hãy nhập đúng định dạng. vd: n18dccn004";
        }
        else if(MaSV.length !== 10)
        {
          errMSSV = "Mã số sinh viên có đúng 10 kí tự";
        }
        else {
          errMSSV = "";
        }


        if (isNumeric(phone) === false) {
          errPhone = "Vui lòng chỉ nhập số";
        }
        else if(phone.length>14)
        {
          errPhone ="Số điện thoại quá dài";
        }
        else {
          errPhone = "";
        }
        if (/^[a-zA-Z][a-zA-Z\s]*$/.test(name) === false) {
          errFullName = "Vui lòng chỉ nhập chữ vào họ và tên";

        }
        else {
          errFullName = "";
        }

        var count;
        if (typeof (selected) !== "undefined") {
          for (let index = 0; index < selected.length; index++) {
            count = req.body.count;
            for (let i = 0; i < selected.length; i++) {

              const indexDelete = count.indexOf("");
              if (indexDelete > -1) {
                count.splice(indexDelete, 1);
              }

            }
          }
        }

        console.log(count);

        function checkNumberInSL() {
          if (typeof (selected) === "undefined") {
            return true;
          }
          else if (typeof (selected) === "string") {
            if (isNumeric(count[0]) === false) {
              return false;
            }
            else {
              return true;
            }


          }
          else {
            for (let i = 0; i < selected.length; i++) {
              if (isNumeric(count[i]) === false) {
                return false;
              }

            }
            return true;
          }
        };


        var sumAllLoanEquip;
        function getCurrentCount(nameE) {
          sumAllLoanEquip = 0;
          if (resultAll) {
            for (let index = 0; index < resultAll.length; index++) {
              for (let i = 0; i < resultAll[index].equipmentList.length; i++) {
                if (resultAll[index].equipmentList[i].name === nameE) {
                  sumAllLoanEquip += parseInt(resultAll[index].equipmentList[i].count);
                }
              }
            }
          }
        }




        if (typeof (selected) === "undefined") {
          errEquipment = "Chưa chọn thiết bị";
        }
        else if (count.length === 0) {
          errEquipment = "Chưa chọn số lượng";
        }
        else if (typeof (selected) === "string" && count.length !== 1) {
          errEquipment = "Nhập sai thiết bị";

        } else if (typeof (selected) === "object" && selected.length !== count.length) {
          errEquipment = "Nhập sai thiết bị";
        }
        else if (checkNumberInSL() === false) {
          errEquipment = "Vui lòng chỉ nhập số vào ô số lượng";
        }
        else if (typeof (selected) === "string") {
          getCurrentCount(selected);

          console.log(sumAllLoanEquip);
          console.log(resultOneE.max);
          console.log(parseInt(count[0]) > (resultOneE.max - sumAllLoanEquip));
          if (parseInt(count[0]) > (resultOneE.max - sumAllLoanEquip)) {
            errEquipment = "Số lượng " + resultOneE.name + " chọn lớn hơn số thiết bị " + (parseInt(count[0]) - (resultOneE.max - sumAllLoanEquip)) + " cái";
          }
          else {
            errEquipment = "";
          }

        }
        else if (typeof (selected) === "object") {
          for (let index = 0; index < selected.length; index++) {

            Equipment.findOne({ name: selected[index] }, function (err, result) {
              getCurrentCount(selected[index]);
              console.log(sumAllLoanEquip);
              console.log(result.max);
              if (parseInt(count[index]) > (result.max - sumAllLoanEquip)) {
                errEquipment = errEquipment + result.name + " vượt quá " + (parseInt(count[index]) - (result.max - sumAllLoanEquip)) + " cái. ";
              }
              else {
                errEquipment = errEquipment + "";
              }
            });
          }

        }


        else {
          errEquipment = "";
        }
        Equipment.find({}, function (err, result) {
          if (errMSSV !== "" || errPhone !== "" || errEquipment !== "" || errFullName !== "") {

            if (!err) {
              res.render("studentBorrowOnline",
                {
                  loanHome: result,
                  errMSSV: errMSSV,
                  errPhone: errPhone,
                  errFullName: errFullName,
                  errEquipment: errEquipment
                });
              errEquipment = "";
            }

          }

          else {
            const loan1 = new Loan({
              MSSV: MaSV,
              studentName: name,
              phone: phone,
              roomName: roomName,
              note: note,
              day: today
            });

            if (typeof (selected) === "string") {
              Equipment.findOne({ name: selected }, function (err, result) {
                if (result) {
                  result.count = count[0];
                  loan1.equipmentList.push(result);
                }
                loan1.save();

              }
              )
            }
            else {


              for (let index = 0; index < selected.length; index++) {

                Equipment.findOne({ name: selected[index] }, function (err, result) {
                  if (result) {
                    result.count = count[index];
                    loan1.equipmentList.push(result);
                  }
                  if (index === selected.length - 1) {
                    loan1.save();
                  }
                }
                )
              };
            }

            //   console.log(loan1);





            res.redirect("/transfer");



          }
        });
      })
    });
  })
});
app.get("/successLoanOn", function (req, res) {
  res.render("successLoanOn");
})
app.get("/transfer", function (req, res) {
  if (req.isAuthenticated()) {
    console.log(maSVForTrans);
    const idAdd = req.user.username;
    Loan.findOne({ MSSV: maSVForTrans }, function (err, resultLO) {

      const loanOn1 = new LoanOnline({
        email: idAdd,
        borrowOn: resultLO
      });

      loanOn1.save();
    })

    Loan.findOneAndDelete({ MSSV: maSVForTrans }, function (err) {
      if (err) {
        console.log(err);
      }
      else {
        console.log("delete on");
      }
    })

    res.redirect("/successLoanOn");
  }
  else {
    res.redirect("/");
  }
})

////////----------------
app.post("/", function (req, res) {
  const checkStaff = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(checkStaff, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local", { successRedirect: '/home', failureRedirect: "/" })(req, res, function () {

      })
    }
  })

});





// //-------------------------------------------------------check after

app.get("/home", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    res.redirect("/homeAdmin")
  }
  else if (req.isAuthenticated()) {
    Loan.find({ day: { $lt: getCurrentDay() } }, function (err1, result1) {
      res.render("home", { nameStaff: req.user.username, EquipmentOutOfDate: result1.length });
    })

  }

  else {
    res.redirect("/");
  }
});
app.get("/logOut", function (req, res) {
  messageLogin = "";
  req.logout();
  res.redirect("/");
})
// -------------------borrow
var errMSSV = "";
var errPhone = "";
var errEquipment = "";
var errFullName = "";


app.get("/borrow", function (req, res) {
  if (req.isAuthenticated()) {
    errMSSV = "";
    errPhone = "";
    errEquipment = "";
    errRoom = "";
    errFullName = "";
    Equipment.find({}, function (err, result) {
      if (!err) {
        res.render("borrow",
          {
            loanHome: result,
            errMSSV: errMSSV,
            errPhone: errPhone,
            errFullName: errFullName,
            errEquipment: errEquipment
          });
      }
    });
  } else {
    res.redirect("/");
  }
});
// get the current date :
function getDay(d) {
  var today = new Date(d);
  var dd = String(today.getDate()).padStart(2, '0');
  var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
  var yyyy = today.getFullYear();

  return today = mm + '/' + dd + '/' + yyyy;
}
function getCurrentDay() {
  var today = new Date();
  var dd = String(today.getDate()).padStart(2, '0');
  var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
  var yyyy = today.getFullYear();

  return today = mm + '/' + dd + '/' + yyyy;
}
var today = new Date();

function isNumeric(str) {
  if (typeof str != "string") return false // we only process strings!  
  return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}
//n18dccn004
function checkMSSV(str){
  var STempt1 = str.slice(0,1);
  var STempt2 = str.slice(1,3);
  var STempt3 = str.slice(3,7);
  var STempt4 = str.slice(7,10);
  console.log(STempt1+"--"+STempt2+"--"+STempt3+"--"+STempt4+"--")
  if (/^[a-zA-Z][a-zA-Z\s]*$/.test(STempt1) && isNumeric(STempt2) && isNumeric(STempt4) && /^[a-zA-Z][a-zA-Z\s]*$/.test(STempt3) ) {
    return true;
  }
  else
  {
    return false;
  }
};


app.post("/borrow", function (req, res) {
  var MaSV = req.body.mssv;
  var name = req.body.name;
  var phone = req.body.phone;
  var roomName = req.body.roomName;
  var note = req.body.note;
  var selected = req.body.select;
  name = titleCase(name);
  name = name.trim();

  Loan.find({}, function (err, resultAll) {
    Loan.findOne({ MSSV: MaSV }, function (err, result) {
      Equipment.findOne({ name: selected }, function (err, resultOneE) {
        if (result) {
          errMSSV = "Mã sinh viên đang mượn";

        }
        else if(checkMSSV(MaSV)=== false)
        {
          errMSSV = "Hãy nhập đúng định dạng. vd: n18dccn004";
        }
        else if(MaSV.length !== 10)
        {
          errMSSV = "Mã số sinh viên có đúng 10 kí tự";
        }
        else {
          errMSSV = "";
        }


        if (isNumeric(phone) === false) {
          errPhone = "Vui lòng chỉ nhập số";
        }
        else if(phone.length>14)
        {
          errPhone ="Số điện thoại quá dài";
        }
        else {
          errPhone = "";
        }
        if (/^[a-zA-Z][a-zA-Z\s]*$/.test(name) === false) {
          errFullName = "Vui lòng chỉ nhập chữ vào họ và tên";

        }
        else {
          errFullName = "";
        }


        var count;
        if (typeof (selected) !== "undefined") {
          for (let index = 0; index < selected.length; index++) {
            count = req.body.count;
            console.log(count);
            for (let i = 0; i <= selected.length; i++) {

              const indexDelete = count.indexOf("");
              if (indexDelete > -1) {
                count.splice(indexDelete, 1);
              }

            }
          }
        }
        console.log(count);

        function checkNumberInSL() {
          if (typeof (selected) === "undefined") {
            return true;
          }
          else if (typeof (selected) === "string") {
            if (isNumeric(count[0]) === false) {
              return false;
            }
            else {
              return true;
            }


          }
          else {
            for (let i = 0; i < selected.length; i++) {
              if (isNumeric(count[i]) === false) {
                return false;
              }

            }
            return true;
          }
        };


        var sumAllLoanEquip;
        function getCurrentCount(nameE) {
          sumAllLoanEquip = 0;
          if (resultAll) {
            for (let index = 0; index < resultAll.length; index++) {
              for (let i = 0; i < resultAll[index].equipmentList.length; i++) {
                if (resultAll[index].equipmentList[i].name === nameE) {
                  sumAllLoanEquip += parseInt(resultAll[index].equipmentList[i].count);
                }
              }
            }
          }
        }




        if (typeof (selected) === "undefined") {
          errEquipment = "Chưa chọn thiết bị";
        }
        else if (count.length === 0) {
          errEquipment = "Chưa chọn số lượng";
        }
        else if (typeof (selected) === "string" && count.length !== 1) {
          errEquipment = "Nhập sai thiết bị";

        } else if (typeof (selected) === "object" && selected.length !== count.length) {
          errEquipment = "Nhập sai thiết bị";
        }
        else if (checkNumberInSL() === false) {
          errEquipment = "Vui lòng chỉ nhập số vào ô số lượng";
        }

        else if (typeof (selected) === "string") {
          getCurrentCount(selected);

          console.log(sumAllLoanEquip);
          console.log(resultOneE.max);
          console.log(parseInt(count[0]) > (resultOneE.max - sumAllLoanEquip));
          if (parseInt(count[0]) > (resultOneE.max - sumAllLoanEquip)) {
            errEquipment = "Số lượng " + resultOneE.name + " chọn lớn hơn số thiết bị " + (parseInt(count[0]) - (resultOneE.max - sumAllLoanEquip)) + " cái";
          }
          else {
            errEquipment = "";
          }

        }

        else if (typeof (selected) === "object") {
          for (let index = 0; index < selected.length; index++) {

            Equipment.findOne({ name: selected[index] }, function (err, result) {
              getCurrentCount(selected[index]);
              console.log(sumAllLoanEquip);
              console.log(result.max);
              if (parseInt(count[index]) > (result.max - sumAllLoanEquip)) {
                errEquipment = errEquipment + result.name + " vượt quá " + (parseInt(count[index]) - (result.max - sumAllLoanEquip)) + " cái. ";

              }
              else {
                errEquipment = errEquipment + "";
              }
            });
          }

        }


        else {
          errEquipment = "";
        }
        Equipment.find({}, function (err, result) {
          if (errMSSV !== "" || errPhone !== "" || errEquipment !== "" || errFullName !== "") {

            if (!err) {
              res.render("borrow",
                {
                  loanHome: result,
                  errMSSV: errMSSV,
                  errPhone: errPhone,
                  errFullName: errFullName,
                  errEquipment: errEquipment
                });

              errEquipment = "";

            }

          }

          else {
            const loan1 = new Loan({
              MSSV: MaSV,
              studentName: name,
              phone: phone,
              roomName: roomName,
              note: note,
              day: today
            });

            if (typeof (selected) === "string") {
              Equipment.findOne({ name: selected }, function (err, result) {
                console.log(result);
                if (result) {
                  result.count = count[0];
                  loan1.equipmentList.push(result);
                }
                loan1.save();

              }
              )
            }
            else {


              for (let index = 0; index < selected.length; index++) {

                Equipment.findOne({ name: selected[index] }, function (err, result) {
                  console.log(result);
                  if (result) {
                    result.count = count[index];
                    loan1.equipmentList.push(result);
                  }
                  if (index === selected.length - 1) {
                    loan1.save();
                  }
                }
                )
              };
            }


            User.findById(req.user.id, function (err, resultForUser) {
              console.log(typeof (resultForUser.username));
              LoanHistory.findOne({ username: resultForUser.username }, function (err, checkUsername) {
                if (err) {
                  console.log(err);
                }
                else if (checkUsername) {
                  checkUsername.add.push(loan1);
                  checkUsername.save();
                }
                else if (!checkUsername) {
                  const newLoanHistory = new LoanHistory({
                    username: resultForUser.username
                  });
                  newLoanHistory.add.push(loan1);
                  newLoanHistory.save();
                }
              })


            })



            res.redirect("/manage");

          }
        });
      })
    });
  })
});


//------------------------------------------------------------------------------------------


app.get("/manage", function (req, res) {
  if (req.isAuthenticated()) {
    Loan.find({ day: { $gte: getCurrentDay() } }, function (err, result) {
      if (!err) {
        Loan.find({ day: { $lt: getCurrentDay() } }, function (err1, result1) {
          res.render("manages", { loanManage: result, loanManage1: result1 });
        })

      }
    });
  } else {
    res.redirect("/");
  }
});
//----------------------Pricing------
app.get("/pricing/:paramName", function (req, res) {
  const getMSSV = req.params.paramName;
  var sum = 0;
  if (req.isAuthenticated()) {
    Loan.findOne({ MSSV: getMSSV }, function (err, result) {
      if (!result) {
        if (req.user.id === process.env.ADMIN_KEY) {
          res.redirect("/manageAdmin");
        }
        else {
          res.redirect("/manage");
        }
      }
      else {
        res.render("pricing", { student: result, day: getDay(result.day), sum: sum });
      }
    })
  }
  else {
    res.redirect("/");
  }
});

app.post("/pricing/:paramName", function (req, res) {
  const getMSSV = req.params.paramName;
  const arrayCount = req.body.losing;
  console.log(arrayCount);
  var sum = 0;
  Loan.findOne({ MSSV: getMSSV }, function (err, result) {
    if (!result) {
      if (req.user.id === process.env.ADMIN_KEY) {
        res.redirect("/manageAdmin");
      }
      else {
        res.redirect("/manage");
      }
    }
    else {
      for (let index = 0; index < arrayCount.length; index++) {
        sum = (result.equipmentList[index].cost * parseInt(arrayCount[index])) + sum;
      }
      res.render("pricing", { student: result, day: getDay(result.day), sum: sum });
    }
  })
});

//----------------------Manage each student-------------------


app.get("/manage/:paramName", function (req, res) {
  if (req.isAuthenticated()) {
    const listName = req.params.paramName;


    Loan.findOne({ MSSV: listName }, function (err, result) {
      if (!result) {
        res.redirect("/");
      } else {
        res.render("newmanage", { loanManage: result, day: getDay(result.day) });
      }
    });
  }
  else {
    res.redirect("/");
  }
});

app.post("/loanDelete", function (req, res) {
  var MSSVforDelete = req.body.getMSSV;
  Loan.findOne({ MSSV: MSSVforDelete }, function (err, loan1) {
    if (loan1) {
      User.findById(req.user.id, function (err, resultForUser) {
        console.log(resultForUser.username);
        LoanHistory.findOne({ username: resultForUser.username }, function (err, checkUsername) {
          if (err) {
            console.log(err);
          }
          else if (checkUsername) {
            checkUsername.delete.push(loan1);
            checkUsername.save();
          }
          else if (!checkUsername) {
            const newLoanHistory = new LoanHistory({
              username: resultForUser.username
            });
            newLoanHistory.delete.push(loan1);
            newLoanHistory.save();
          }
        })


      })
    }
    else if (err) {
      console.log(err);
    }


  })

  Loan.findOneAndDelete({ MSSV: MSSVforDelete }, function (err) {
    if (!err) {
      console.log("Delete done");
      if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
        res.redirect("/manageAdmin");
      }
      else if (req.isAuthenticated()) {
        res.redirect("/manage");
      }
    }
  })
});

app.get("/EditStudent/:paramName", function (req, res) {
  if (req.isAuthenticated()) {
    const MSSV = req.params.paramName;


    Loan.findOne({ MSSV: MSSV }, function (err, result) {
      if (!result) {
        res.redirect("/home");
      } else {
        Equipment.find({}, function (err, result1) {
          if (!err) {
            res.render("editStudent", {
              edit: result,
              loanHome: result1,
              errMSSV: errMSSV,
              errPhone: errPhone,
              errEquipment: errEquipment

            });
          }
        });

      }
    });
  }
  else {
    res.redirect("/");
  }
});
app.post("/EditStudent/:paramName", function (req, res) {
  if (req.isAuthenticated()) {
    Equipment.findOne({ name: req.body.select }, function (err, resultOneE) {
      const MSSV1 = req.params.paramName;


      var MaSV = req.body.mssv;
      var name = req.body.name;
      var phone = req.body.phone;
      var roomName = req.body.roomName;
      var note = req.body.note;
      var selected = req.body.select;
      name = titleCase(name);

      Loan.find({}, function (err, resultAll) {
        errMSSV = "";
        if(checkMSSV(MaSV)=== false)
        {
          errMSSV = "Hãy nhập đúng định dạng. vd: n18dccn004";
        }
        else if(MaSV.length !== 10)
        {
          errMSSV = "Mã số sinh viên có đúng 10 kí tự";
        }
        else {
          errMSSV = "";
        }



        if (isNumeric(phone) === false) {
          errPhone = "Vui lòng chỉ nhập số";
        }
        else if(phone.length>14)
        {
          errPhone ="Số điện thoại quá dài";
        }
        else {
          errPhone = "";
        }

        var count;
        if (typeof (selected) !== "undefined") {
          for (let index = 0; index < selected.length; index++) {
            count = req.body.count;
            for (let i = 0; i <= selected.length; i++) {

              const indexDelete = count.indexOf("");
              if (indexDelete > -1) {
                count.splice(indexDelete, 1);
              }

            }
          }
        }
        console.log(count);

        function checkNumberInSL() {
          if (typeof (selected) === "undefined") {
            return true;
          }
          else if (typeof (selected) === "string") {
            if (isNumeric(count[0]) === false) {
              return false;
            }
            else {
              return true;
            }


          }
          else {
            for (let i = 0; i < selected.length; i++) {
              if (isNumeric(count[i]) === false) {
                return false;
              }

            }
            return true;
          }
        };

        var sumAllLoanEquip;
        function getCurrentCount(nameE) {
          sumAllLoanEquip = 0;
          if (resultAll) {
            for (let index = 0; index < resultAll.length; index++) {
              for (let i = 0; i < resultAll[index].equipmentList.length; i++) {
                if (resultAll[index].equipmentList[i].name === nameE) {
                  sumAllLoanEquip += parseInt(resultAll[index].equipmentList[i].count);
                }
              }
            }
          }
        }

        if (typeof (selected) === "undefined") {
          errEquipment = "Chưa chọn thiết bị";
        }
        else if (count.length === 0) {
          errEquipment = "Chưa chọn số lượng";
        }
        else if (typeof (selected) === "string" && count.length !== 1) {
          errEquipment = "Nhập sai thiết bị";

        } else if (selected.length === "object" && selected.length !== count.length) {
          errEquipment = "Nhập sai thiết bị";
        }

        else if (checkNumberInSL() === false) {
          errEquipment = "Vui lòng chỉ nhập số vào ô số lượng";
        }

        else if (typeof (selected) === "string") {
          getCurrentCount(selected);

          console.log(sumAllLoanEquip);
          console.log(resultOneE.max);
          if (parseInt(count[0]) > resultOneE.max - sumAllLoanEquip) {
            errEquipment = "Số lượng " + resultOneE.name + " chọn lớn hơn số thiết bị " + (parseInt(count[0]) - (resultOneE.max - sumAllLoanEquip)) + " cái";
          }
          else {
            errEquipment = "";
          }


        }
        else if (typeof (selected) === "object") {
          for (let index = 0; index < selected.length; index++) {

            Equipment.findOne({ name: selected[index] }, function (err, result) {
              getCurrentCount(selected[index]);
              console.log(sumAllLoanEquip);
              console.log(result.max);
              if (parseInt(count[index]) > (result.max - sumAllLoanEquip)) {
                errEquipment = errEquipment + result.name + " vượt quá " + (parseInt(count[index]) - (result.max - sumAllLoanEquip)) + " cái. ";
              }
              else {
                errEquipment = errEquipment + "";
              }
            });
          }

        }


        else {
          errEquipment = "";
        }

        Equipment.find({}, function (err, result1) {
          if (errMSSV !== "" || errPhone !== "" || errEquipment !== "") {

            Loan.findOne({ MSSV: MSSV1 }, function (err, result) {
              if (!result) {
                res.redirect("/home");
              } else {

                if (!err) {
                  res.render("editStudent", {
                    edit: result,
                    loanHome: result1,
                    errMSSV: errMSSV,
                    errPhone: errPhone,
                    errEquipment: errEquipment

                  });
                  errEquipment = "";

                }


              }
            });

          }
          else {

            Loan.findOne({ MSSV: MSSV1 }, function (err, loan1) {


              User.findById(req.user.id, function (err, resultForUser) {
                console.log(typeof (resultForUser.username));
                LoanHistory.findOne({ username: resultForUser.username }, function (err, checkUsername) {
                  if (err) {
                    console.log(err);
                  }
                  else if (checkUsername) {
                    checkUsername.edit.push(loan1);
                    checkUsername.save();
                  }
                  else if (!checkUsername) {
                    const newLoanHistory = new LoanHistory({
                      username: resultForUser.username
                    });
                    newLoanHistory.edit.push(loan1);
                    newLoanHistory.save();
                  }
                })


              })

            })
            Loan.findOneAndDelete({ MSSV: MSSV1 }, function (err) {
              if (err) {
                console.log(err);
              }

            });

            const loan1 = new Loan({
              MSSV: MaSV,
              studentName: name,
              phone: phone,
              roomName: roomName,
              note: note,
              day: today
            });

            if (typeof (selected) === "string") {
              Equipment.findOne({ name: selected }, function (err, result) {
                console.log(result);
                if (result) {
                  result.count = count[0];
                  loan1.equipmentList.push(result);
                }
                loan1.save();

              }
              )
            }
            else {


              for (let index = 0; index < selected.length; index++) {

                Equipment.findOne({ name: selected[index] }, function (err, result) {
                  console.log(result);
                  if (result) {
                    result.count = count[index];
                    loan1.equipmentList.push(result);
                  }
                  if (index === selected.length - 1) {
                    loan1.save();
                  }
                }
                )
              };
            }


            User.findById(req.user.id, function (err, resultForUser) {
              console.log(typeof (resultForUser.username));
              LoanHistory.findOne({ username: resultForUser.username }, function (err, checkUsername) {
                if (err) {
                  console.log(err);
                }
                else if (checkUsername) {
                  checkUsername.edit.push(loan1);
                  checkUsername.save();
                }
                else if (!checkUsername) {
                  const newLoanHistory = new LoanHistory({
                    username: resultForUser.username
                  });
                  newLoanHistory.edit.push(loan1);
                  newLoanHistory.save();
                }
              })


            })



            res.redirect("/manage");

          }
        });
        // })
      });
    })
  }

});


app.get("/manageLoanOnline", function (req, res) {
  if (req.isAuthenticated()) {
    var resultChecked = [];
    LoanOnline.find({}, function (err, result) {

      if (err) {
        console.log(err);
      }
      else {
        // console.log(getDay(result[0].borrowOn.day));
        // console.log(typeof(getDay(result[0].borrowOn.day)));
        // console.log(getCurrentDay());
        // console.log(typeof(getCurrentDay()));
        for (let index = 0; index < result.length; index++) {

          if (getDay(result[index].borrowOn.day) === getCurrentDay()) {
            resultChecked.push(result[index]);
          }

        }
        res.render("manageLoanOnline", { loanOn: resultChecked });
      }
    })
  }
  else {
    res.redirect("/");
  }

});

app.get("/manageLoanOnline/:paramid", function (req, res) {
  const findId = req.params.paramid;
  LoanOnline.findOne({ _id: findId }, function (err, result) {
    const loan2 = new Loan({
      MSSV: result.borrowOn.MSSV,
      studentName: result.borrowOn.studentName,
      phone: result.borrowOn.phone,
      roomName: result.borrowOn.roomName,
      note: result.borrowOn.note,
      day: result.borrowOn.day,
      equipmentList: result.borrowOn.equipmentList
    })
    loan2.save();
    User.findById(req.user.id, function (err, resultForUser) {
      console.log(typeof (resultForUser.username));
      LoanHistory.findOne({ username: resultForUser.username }, function (err, checkUsername) {
        if (err) {
          console.log(err);
        }
        else if (checkUsername) {
          checkUsername.add.push(loan2);
          checkUsername.save();
        }
        else if (!checkUsername) {
          const newLoanHistory = new LoanHistory({
            username: resultForUser.username
          });
          newLoanHistory.add.push(loan2);
          newLoanHistory.save();
        }
      })


    })
  })



  LoanOnline.findOneAndDelete({ _id: findId }, function (err) {
    if (err) {
      console.log(err);
    }
  });
  res.redirect("/manage");
})

// -------------------------------------------------Admin-------------------------------
app.post("/staffDelete", function (req, res) {
  var MSNVforDelete = req.body.getMSNV;
  Staff.findOne({ MSNV: MSNVforDelete }, function (err, result) {
    if (err) {
      console.log(err);
    }
    else {
      User.findOneAndDelete({ username: result.user.username }, function (err) {
        if (err) {
          console.log(err);
        }
      });
    }
  });
  Staff.findOneAndDelete({ MSNV: MSNVforDelete }, function (err) {
    if (!err) {
      console.log("Delete done");
      res.redirect("/updateStaff")
    }
  })
});

var thisYear = today.getFullYear;
//------------------------signUp----------------------------
var errMSNV;
var errTDN;
var errMK;
var errAge;


app.get("/homeAdmin", function (req, res) {
  errMSNV = "";
  errTDN = "";
  errMK = "";
  errAge = "";

  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    res.render("homeAdmin", {
      errMSNV: errMSNV,
      errTDN: errTDN,
      errMK: errMK,
      errAge: errAge
    });
  }
  else {
    res.redirect("/");
  }

});

app.post("/homeAdmin", function (req, res) {
  User.findOne({ username: req.body.username }, function (err, resultName) {
    Staff.findOne({ MSNV: req.body.MSNV }, function (err, result) {
      if (result) {
        errMSNV = "Mã số nhân viên đã tồn tại";
      }
      else {
        errMSNV = "";
      }
      console.log(resultName);
      if (resultName) {
        errTDN = "Tên đăng nhập đã tồn tại";
      }
      else {
        errTDN = "";
      }

      console.log(errTDN);

      if (req.body.age === "Tuổi") {
        errAge = "Mời bạn chọn tuổi";
      }
      else {
        errAge = "";
      }

      if (req.body.password.length < 5) {
        errMK = "Mật khẩu phải có ít nhất 6 kí tự";
      }
      else {
        errMK = "";
      };

      if (errMSNV !== "" || errTDN !== "" || errMK !== "" || errAge !== "") {
        res.render("homeAdmin", {
          errMSNV: errMSNV,
          errTDN: errTDN,
          errMK: errMK,
          errAge: errAge
        });

      }
      else {
        User.register({
          username: req.body.username
        }, req.body.password, function (err, user) {
          if (err) {
            console.log(err);
            res.redirect("/homeAdmin");
          }
          else if (user) {
            const newStaff = new Staff({
              user: user,
              MSNV: req.body.MSNV,
              staffName: req.body.staffName,
              address: req.body.address,
              sex: req.body.sex,
              age: req.body.age
            });
            newStaff.save();
            Admin.findOne({ name: "thay Hanh" }, function (err, result) {
              if (err) {
                res.redirect("/homeAdmin");
              }
              else if (result) {
                result.listStaff.push(newStaff);
                result.save();
              }
            })
            res.redirect("/updateStaff");
          }
          else {
            passport.authenticate("local")(req, res, function () {
              console.log(user);
              console.log(newStaff);
              res.redirect("/homeAdmin");
            })
          }
        })

      }
    });
  });
});
app.get("/updateStaff", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    Staff.find({}, function (err, result) {
      if (!err) {
        res.render("updateStaff", { updateStaff: result });
      }
    });
  }
  else {
    res.redirect("/");
  }
});

app.get("/updateStaff/:paramName", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    const MSNV = req.params.paramName;


    Staff.findOne({ MSNV: MSNV }, function (err, result) {
      if (!result) {
        res.redirect("/homeAdmin");
      } else {
        res.render("staffManage", { staffManage: result });
      }
    });
  }
  else {
    res.redirect("/");
  }

});


app.get("/Edit/:paramName", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    const MSNV = req.params.paramName;

    errMSNV = "";
    errTDN = "";
    errMK = "";
    errAge = "";

    Staff.findOne({ MSNV: MSNV }, function (err, result) {
      if (!result) {
        res.redirect("/homeAdmin");
      } else {
        res.render("editStaff", {
          staffEdit: result,
          errMSNV: errMSNV,
          errTDN: errTDN,
          errMK: errMK,
          errAge: errAge
        });
      }
    });
  }
  else {
    res.redirect("/");
  }
});

app.post("/Edit/:paramName", function (req, res) {
  Staff.findOne({ MSNV: req.body.MSNV }, function (err, result) {
    Staff.findOne({ MSNV: req.params.paramName }, function (err, resultName) {
      Staff.findOne({ username: req.body.username }, function (err, resultUser) {
        const MSNV = req.params.paramName;
        if (req.body.MSNV !== MSNV) {

          if (result) {
            errMSNV = "Mã số nhân viên đã tồn tại";
          }
          else {
            errMSNV = "";
          }


        }



        if (resultName.username !== req.body.username) {

          if (resultUser) {
            errTDN = "Tên đăng nhập đã tồn tại";
          }
          else {
            errTDN = "";
          }


        }



        console.log(req.body.age);
        if (req.body.age === "Tuổi") {
          errAge = "Mời bạn chọn tuổi";
        }
        else {
          errAge = "";
        }

        if (req.body.password.length < 5) {
          errMK = "Mật khẩu phải có ít nhất 6 kí tự";
        }
        else {
          errMK = "";
        };

        if (errMSNV !== "" || errTDN !== "" || errMK !== "" || errAge !== "") {
          Staff.findOne({ MSNV: MSNV }, function (err, result) {
            if (!result) {
              res.redirect("/homeAdmin");
            } else {
              res.render("editStaff", {
                staffEdit: result,
                errMSNV: errMSNV,
                errTDN: errTDN,
                errMK: errMK,
                errAge: errAge
              });
            }
          });
        }

        else {
          Staff.findOne({ MSNV: req.body.MSNV }, function (err, result) {
            if (err) {
              console.log(err);
            }
            else {
              User.findOneAndDelete({ username: result.user.username }, function (err) {
                if (err) {
                  console.log(err);
                }
              });
            }
          });
          Staff.findOneAndDelete({ MSNV: req.body.MSNV }, function (err) {
            if (err) {
              console.log(err);
            }
            else {
              console.log("Delete and update");
              User.register({
                username: req.body.username
              }, req.body.password, function (err, user) {
                if (err) {
                  console.log(err);
                  res.redirect("/homeAdmin");
                }
                else if (user) {
                  const newStaff = new Staff({
                    user: user,
                    MSNV: req.body.MSNV,
                    staffName: req.body.staffName,
                    address: req.body.address,
                    sex: req.body.sex,
                    age: req.body.age
                  });
                  newStaff.save();
                  Admin.findOne({ name: "thay Hanh" }, function (err, result) {
                    if (err) {
                      res.redirect("/homeAdmin");
                    }
                    else if (result) {
                      for (let index = 0; index < result.listStaff.length; index++) {
                        if (result.listStaff[index].MSNV === req.params.paramName) {
                          if (index === 0) {
                            result.listStaff.shift();
                          } else {


                            result.listStaff.splice(index, index);
                            console.log("Update Staff List Done");
                          }
                        }


                      }
                      result.listStaff.push(newStaff);
                      result.save();
                    }
                  })
                  res.redirect("/updateStaff");
                }
                else {
                  passport.authenticate("local")(req, res, function () {
                    console.log(user);
                    console.log(newStaff);
                    res.redirect("/updateStaff");
                  })
                }
              })
            }
          });



        }
      });
    });
  });
});


//-------Admin borrow
app.get("/borrowAdmin", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    errMSSV = "";
    errPhone = "";
    errEquipment = "";
    errRoom = "";
    errFullName = "";
    Equipment.find({}, function (err, result) {
      if (!err) {
        res.render("borrowAdmin",
          {
            loanHome: result,
            errMSSV: errMSSV,
            errPhone: errPhone,
            errFullName: errFullName,
            errEquipment: errEquipment
          });
      }
    });
  }
  else {
    res.redirect("/");
  }
});
app.post("/borrowAdmin", function (req, res) {

  var MaSV = req.body.mssv;
  var name = req.body.name;
  var phone = req.body.phone;
  var roomName = req.body.roomName;
  var note = req.body.note;
  var selected = req.body.select;
  name = titleCase(name);
  name = name.trim();


  Loan.find({}, function (err, resultAll) {
    Loan.findOne({ MSSV: MaSV }, function (err, result) {
      Equipment.findOne({ name: selected }, function (err, resultOneE) {
        if (result) {
          errMSSV = "Mã sinh viên đang mượn";

        }
        else if(checkMSSV(MaSV)=== false)
        {
          errMSSV = "Hãy nhập đúng định dạng. vd: n18dccn004";
        }
        else if(MaSV.length !== 10)
        {
          errMSSV = "Mã số sinh viên có đúng 10 kí tự";
        }
        else {
          errMSSV = "";
        }


        if (isNumeric(phone) === false) {
          errPhone = "Vui lòng chỉ nhập số";
        }
        else if(phone.length>14)
        {
          errPhone ="Số điện thoại quá dài";
        }
        else {
          errPhone = "";
        }
        if (/^[a-zA-Z][a-zA-Z\s]*$/.test(name) === false) {
          errFullName = "Vui lòng chỉ nhập chữ vào họ và tên";

        }
        else {
          errFullName = "";
        }


        var count;
        if (typeof (selected) !== "undefined") {
          for (let index = 0; index < selected.length; index++) {
            count = req.body.count;
            for (let i = 0; i <= selected.length; i++) {

              const indexDelete = count.indexOf("");
              if (indexDelete > -1) {
                count.splice(indexDelete, 1);
              }

            }
          }
        }
        console.log(count);

        function checkNumberInSL() {
          if (typeof (selected) === "undefined") {
            return true;
          }
          else if (typeof (selected) === "string") {
            if (isNumeric(count[0]) === false) {
              return false;
            }
            else {
              return true;
            }


          }
          else {
            for (let i = 0; i < selected.length; i++) {
              if (isNumeric(count[i]) === false) {
                return false;
              }

            }
            return true;
          }
        };


        var sumAllLoanEquip;
        function getCurrentCount(nameE) {
          sumAllLoanEquip = 0;
          if (resultAll) {
            for (let index = 0; index < resultAll.length; index++) {
              for (let i = 0; i < resultAll[index].equipmentList.length; i++) {
                if (resultAll[index].equipmentList[i].name === nameE) {
                  sumAllLoanEquip += parseInt(resultAll[index].equipmentList[i].count);
                }
              }
            }
          }
        }




        if (typeof (selected) === "undefined") {
          errEquipment = "Chưa chọn thiết bị";
        }
        else if (count.length === 0) {
          errEquipment = "Chưa chọn số lượng";
        }
        else if (typeof (selected) === "string" && count.length !== 1) {
          errEquipment = "Nhập sai thiết bị";

        } else if (typeof (selected) === "object" && selected.length !== count.length) {
          errEquipment = "Nhập sai thiết bị";
        }
        else if (checkNumberInSL() === false) {
          errEquipment = "Vui lòng chỉ nhập số vào ô số lượng";
        }
        else if (typeof (selected) === "string") {
          getCurrentCount(selected);

          console.log(sumAllLoanEquip);
          console.log(resultOneE.max);
          console.log(parseInt(count[0]) > (resultOneE.max - sumAllLoanEquip));
          if (parseInt(count[0]) > (resultOneE.max - sumAllLoanEquip)) {
            errEquipment = "Số lượng " + resultOneE.name + " chọn lớn hơn số thiết bị " + (parseInt(count[0]) - (resultOneE.max - sumAllLoanEquip)) + " cái";
          }
          else {
            errEquipment = "";
          }

        }
        else if (typeof (selected) === "object") {
          for (let index = 0; index < selected.length; index++) {

            Equipment.findOne({ name: selected[index] }, function (err, result) {
              getCurrentCount(selected[index]);
              console.log(sumAllLoanEquip);
              console.log(result.max);
              if (parseInt(count[index]) > (result.max - sumAllLoanEquip)) {
                errEquipment = errEquipment + result.name + " vượt quá " + (parseInt(count[index]) - (result.max - sumAllLoanEquip)) + " cái. ";
              }
              else {
                errEquipment = errEquipment + "";
              }
            });
          }

        }


        else {
          errEquipment = "";
        }
        Equipment.find({}, function (err, result) {
          if (errMSSV !== "" || errPhone !== "" || errEquipment !== "" || errFullName !== "") {

            if (!err) {
              res.render("borrowAdmin",
                {
                  loanHome: result,
                  errMSSV: errMSSV,
                  errPhone: errPhone,
                  errEquipment: errEquipment,
                  errFullName: errFullName
                });

              errEquipment = "";

            }

          }
          else {
            const loan1 = new Loan({
              MSSV: MaSV,
              studentName: name,
              phone: phone,
              roomName: roomName,
              note: note,
              day: today
            });

            if (typeof (selected) === "string") {
              Equipment.findOne({ name: selected }, function (err, result) {
                console.log(result);
                if (result) {
                  result.count = count[0];
                  loan1.equipmentList.push(result);
                }
                loan1.save();

              }
              )
            }
            else {


              for (let index = 0; index < selected.length; index++) {

                Equipment.findOne({ name: selected[index] }, function (err, result) {
                  console.log(result);
                  if (result) {
                    result.count = count[index];
                    loan1.equipmentList.push(result);
                  }
                  if (index === selected.length - 1) {
                    loan1.save();
                  }
                }
                )
              };
            }


            User.findById(req.user.id, function (err, resultForUser) {
              console.log(typeof (resultForUser.username));
              LoanHistory.findOne({ username: resultForUser.username }, function (err, checkUsername) {
                if (err) {
                  console.log(err);
                }
                else if (checkUsername) {
                  checkUsername.add.push(loan1);
                  checkUsername.save();
                }
                else if (!checkUsername) {
                  const newLoanHistory = new LoanHistory({
                    username: resultForUser.username
                  });
                  newLoanHistory.add.push(loan1);
                  newLoanHistory.save();
                }
              })


            })


            res.redirect("/manageAdmin");

          }
        });
      })
    });
  });
});
//------Admin Manage---
app.get("/manageAdmin", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    Loan.find({ day: { $gte: getCurrentDay() } }, function (err, result) {
      if (!err) {
        Loan.find({ day: { $lt: getCurrentDay() } }, function (err1, result1) {
          res.render("manageAdmin", { loanManage: result, loanManage1: result1 });
        })

      }
    });
  } else {
    res.redirect("/");
  }



});
//---------------detailLoan
app.get("/manageAdmin/:paramName", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    const listName = req.params.paramName;


    Loan.findOne({ MSSV: listName }, function (err, result) {
      if (!result) {
        res.redirect("/");
      } else {
        res.render("detailLoanAdmin", { loanManage: result, day: getDay(result.day) });
      }
    });
  }
  else {
    res.redirect("/");
  }
});

//-----------------------EditLoan-----------------
app.get("/EditStudentAdmin/:paramName", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    const MSSV = req.params.paramName;


    Loan.findOne({ MSSV: MSSV }, function (err, result) {
      if (!result) {
        res.redirect("/homeAdmin");
      } else {
        Equipment.find({}, function (err, result1) {
          if (!err) {
            res.render("editStudentAdmin", {
              edit: result,
              loanHome: result1,
              errMSSV: errMSSV,
              errPhone: errPhone,
              errEquipment: errEquipment

            });
          }
        });

      }
    });
  }
  else {
    res.redirect("/");
  }
});

app.post("/EditStudentAdmin/:paramName", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    const MSSV1 = req.params.paramName;


    var MaSV = req.body.mssv;
    var name = req.body.name;
    var phone = req.body.phone;
    var roomName = req.body.roomName;
    var note = req.body.note;
    var selected = req.body.select;
    name = titleCase(name);

    Loan.find({}, function (err, resultAll) {

      Equipment.findOne({ name: selected }, function (err, resultOneE) {
        errMSSV = "";
        if(checkMSSV(MaSV)=== false)
        {
          errMSSV = "Hãy nhập đúng định dạng. vd: n18dccn004";
        }
        else if(MaSV.length !== 10)
        {
          errMSSV = "Mã số sinh viên có đúng 10 kí tự";
        }
        else {
          errMSSV = "";
        }

        if (isNumeric(phone) === false) {
          errPhone = "Vui lòng chỉ nhập số";
        }
        else if(phone.length>14)
        {
          errPhone ="Số điện thoại quá dài";
        }
        else {
          errPhone = "";
        }

        var count;
        if (typeof (selected) !== "undefined") {
          for (let index = 0; index < selected.length; index++) {
            count = req.body.count;
            for (let i = 0; i <= selected.length; i++) {

              const indexDelete = count.indexOf("");
              if (indexDelete > -1) {
                count.splice(indexDelete, 1);
              }

            }
          }
        }
        console.log(count);

        function checkNumberInSL() {
          if (typeof (selected) === "undefined") {
            return true;
          }
          else if (typeof (selected) === "string") {
            if (isNumeric(count[0]) === false) {
              return false;
            }
            else {
              return true;
            }


          }
          else {
            for (let i = 0; i < selected.length; i++) {
              if (isNumeric(count[i]) === false) {
                return false;
              }

            }
            return true;
          }
        };

        var sumAllLoanEquip;
        function getCurrentCount(nameE) {
          sumAllLoanEquip = 0;
          if (resultAll) {
            for (let index = 0; index < resultAll.length; index++) {
              for (let i = 0; i < resultAll[index].equipmentList.length; i++) {
                if (resultAll[index].equipmentList[i].name === nameE) {
                  sumAllLoanEquip += parseInt(resultAll[index].equipmentList[i].count);
                }
              }
            }
          }
        }

        if (typeof (selected) === "undefined") {
          errEquipment = "Chưa chọn thiết bị";
        }
        else if (count.length === 0) {
          errEquipment = "Chưa chọn số lượng";
        }
        else if (typeof (selected) === "string" && count.length !== 1) {
          errEquipment = "Nhập sai thiết bị";

        } else if (selected.length === "object" && selected.length !== count.length) {
          errEquipment = "Nhập sai thiết bị";
        }
        else if (checkNumberInSL() === false) {
          errEquipment = "Vui lòng chỉ nhập số vào ô số lượng";
        }
        else if (typeof (selected) === "string") {
          getCurrentCount(selected);

          console.log(sumAllLoanEquip);
          console.log(resultOneE.max);
          if (parseInt(count[0]) > resultOneE.max - sumAllLoanEquip) {
            errEquipment = "Số lượng " + resultOneE.name + " chọn lớn hơn số thiết bị " + (parseInt(count[0]) - (resultOneE.max - sumAllLoanEquip)) + " cái";
          }
          else {
            errEquipment = "";
          }


        }
        else if (typeof (selected) === "object") {
          for (let index = 0; index < selected.length; index++) {

            Equipment.findOne({ name: selected[index] }, function (err, result) {
              getCurrentCount(selected[index]);
              console.log(sumAllLoanEquip);
              console.log(result.max);
              if (parseInt(count[index]) > (result.max - sumAllLoanEquip)) {
                errEquipment = errEquipment + result.name + " vượt quá " + (parseInt(count[index]) - (result.max - sumAllLoanEquip)) + " cái. ";
              }
              else {
                errEquipment = errEquipment + "";
              }
            });
          }

        }


        else {
          errEquipment = "";
        }

        Equipment.find({}, function (err, result1) {
          if (errMSSV !== "" || errPhone !== "" || errEquipment !== "") {

            Loan.findOne({ MSSV: MSSV1 }, function (err, result) {
              if (!result) {
                res.redirect("/home");
              } else {

                if (!err) {
                  res.render("editStudentAdmin", {
                    edit: result,
                    loanHome: result1,
                    errMSSV: errMSSV,
                    errPhone: errPhone,
                    errEquipment: errEquipment

                  });
                  errEquipment = "";
                }


              }
            });

          }
          else {

            Loan.findOne({ MSSV: MSSV1 }, function (err, loan1) {


              User.findById(req.user.id, function (err, resultForUser) {
                console.log(typeof (resultForUser.username));
                LoanHistory.findOne({ username: resultForUser.username }, function (err, checkUsername) {
                  if (err) {
                    console.log(err);
                  }
                  else if (checkUsername) {
                    checkUsername.edit.push(loan1);
                    checkUsername.save();
                  }
                  else if (!checkUsername) {
                    const newLoanHistory = new LoanHistory({
                      username: resultForUser.username
                    });
                    newLoanHistory.edit.push(loan1);
                    newLoanHistory.save();
                  }
                })


              })

            })
            Loan.findOneAndDelete({ MSSV: MSSV1 }, function (err) {
              if (err) {
                console.log(err);
              }

            });

            const loan1 = new Loan({
              MSSV: MaSV,
              studentName: name,
              phone: phone,
              roomName: roomName,
              note: note,
              day: today
            });

            if (typeof (selected) === "string") {
              Equipment.findOne({ name: selected }, function (err, result) {
                console.log(result);
                if (result) {
                  result.count = count[0];
                  loan1.equipmentList.push(result);
                }
                loan1.save();

              }
              )
            }
            else {


              for (let index = 0; index < selected.length; index++) {

                Equipment.findOne({ name: selected[index] }, function (err, result) {
                  console.log(result);
                  if (result) {
                    result.count = count[index];
                    loan1.equipmentList.push(result);
                  }
                  if (index === selected.length - 1) {
                    loan1.save();
                  }
                }
                )
              };
            }


            User.findById(req.user.id, function (err, resultForUser) {
              console.log(typeof (resultForUser.username));
              LoanHistory.findOne({ username: resultForUser.username }, function (err, checkUsername) {
                if (err) {
                  console.log(err);
                }
                else if (checkUsername) {
                  checkUsername.edit.push(loan1);
                  checkUsername.save();
                }
                else if (!checkUsername) {
                  const newLoanHistory = new LoanHistory({
                    username: resultForUser.username
                  });
                  newLoanHistory.edit.push(loan1);
                  newLoanHistory.save();
                }
              })


            })



            res.redirect("/manageAdmin");

          }
        });
        // })
      });
    })
  }

});
//-----------------------------------------------Add Equipment---------------------
var errNameEquipment;
var errQuantity;
var errCost;
app.get("/addEquipment", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    errNameEquipment = "";
    errQuantity = "";
    errCost = "";
    res.render("addEquipment", { errNameEquipment: errNameEquipment, errQuantity: errQuantity, errCost: errCost });
  }
  else {
    res.redirect("/");
  }
});

app.post("/addEquipment", function (req, res) {
  var name = req.body.name;
  var max = req.body.max;
  var cost = req.body.cost;
  Equipment.findOne({name : name}, function(err, result){

  if (result) {
    errNameEquipment = "Đã có thiết bị";
  }
  else if (isNumeric(name) === true) {
    errNameEquipment = "Vui lòng không nhập tên bằng số";
  } else {
    errNameEquipment = "";
  }

  if (isNumeric(max) === false) {
    errQuantity = "Vui lòng nhập số";
  }
  else {
    errQuantity = "";
  }

  if (isNumeric(cost) === false) {
    errCost = "Vui lòng nhập số";
  }
  else {
    errCost = "";
  }


  if (errNameEquipment !== "" || errQuantity !== "" || errCost !== "") {
    res.render("addEquipment", { errNameEquipment: errNameEquipment, errQuantity: errQuantity, errCost: errCost });
  }
  else {
    const newEquipment = new Equipment({
      name: name,
      max: max,
      cost: cost
    });
    newEquipment.save();
    res.redirect("/manageEquipment");
  }
})
});


//--------------------------------------------------------
app.get("/manageEquipment", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    Equipment.find({}, function (err, result) {
      if (!err) {
        res.render("manageEquipment", { updateEquipment: result });
      }
    });
  }
  else {
    res.redirect("/");
  }
});

app.get("/manageEquipmentErr", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    Equipment.find({}, function (err, result) {
      if (!err) {
        res.render("manageEquipmentErr", { updateEquipment: result });
      }
    });
  }
  else {
    res.redirect("/");
  }
});


app.post("/deleteEquipment/:paramName", function (req, res) {
  const findNameEquipment = req.params.paramName;
  Loan.find({}, function (err, resultAll) {
    if (resultAll) {
      for (let index = 0; index < resultAll.length; index++) {
        for (let i = 0; i < resultAll[index].equipmentList.length; i++) {
          if (resultAll[index].equipmentList[i].name === findNameEquipment) {
            return res.redirect("/manageEquipmentErr");

          }
        }
      }
    }
    Equipment.findOneAndDelete({ name: findNameEquipment }, function (err) {
      if (!err) {
        console.log("Equipment delete done");
        res.redirect("/manageEquipment");
      }
    });
  })

});
//--------------------------------Edit Equipment -----------------
app.get("/updateEquipment/:paramName", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    const findNameEquipment = req.params.paramName;
    Loan.find({}, function (err, resultAll) {
      if (resultAll) {
        for (let index = 0; index < resultAll.length; index++) {
          for (let i = 0; i < resultAll[index].equipmentList.length; i++) {
            if (resultAll[index].equipmentList[i].name === findNameEquipment) {
              return res.redirect("/manageEquipmentErr");
  
            }
          }
        }
      }
    })
    Equipment.findOne({ name: findNameEquipment }, function (err, result) {
      if (!err) {
        errNameEquipment = "";
        errQuantity = "";
        errCost = "";
        res.render("updateEquipment", { errNameEquipment: errNameEquipment, errQuantity: errQuantity, errCost: errCost, updateEquipment: result });
      }
    })
  }

  else {
    res.redirect("/");
  }
  
});
app.post("/updateEquipment/:paramName", function (req, res) {
  const findNameEquipment = req.params.paramName;
  const name = req.body.name;
  const max = req.body.max;
  const cost = req.body.cost;
  

  Equipment.findOne({name: name}, function(err, result){

    if (result && name!== findNameEquipment) {
      errNameEquipment = "Đã có thiết bị";
    }
  
  else if (isNumeric(name) === true) {
    errNameEquipment = "Vui lòng không nhập tên bằng số";
  } else {
    errNameEquipment = "";
  }

  if (isNumeric(max) === false) {
    errQuantity = "Vui lòng nhập số";
  }
  else {
    errQuantity = "";
  }

  if (isNumeric(cost) === false) {
    errCost = "Vui lòng nhập số";
  }
  else {
    errCost = "";
  }


  if (errNameEquipment !== "" || errQuantity !== "" || errCost !== "") {
    Equipment.findOne({ name: findNameEquipment }, function (err, result) {
      if (!err) {
        res.render("updateEquipment", { errNameEquipment: errNameEquipment, errQuantity: errQuantity, errCost: errCost, updateEquipment: result });
      }
    })
  }
  else {

    Equipment.findOneAndUpdate({ name: findNameEquipment }, { name: name, max: max, cost: cost }, function (err) {
      if (!err) {
        console.log("Update Equipment Done");
        res.redirect("/manageEquipment");
      }
    })
  }
})
});

app.get("/historyLoan", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    LoanHistory.find({}, function (err, result) {
      if (!err) {
        res.render("historyLoan", { history: result });
      }
    });

  }
  else {
    res.redirect("/");
  }
});

app.get("/historyAdd/:paramUsername", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    const findUsername = req.params.paramUsername;
    LoanHistory.findOne({ username: findUsername }, function (err, result) {
      if (err) {
        console.log(err);
      }
      else {
        res.render("historyAdd", { history: result });
      }
    })
  }
  else {
    res.redirect("/");
  }

});

app.get("/historyDelete/:paramUsername", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    const findUsername = req.params.paramUsername;
    LoanHistory.findOne({ username: findUsername }, function (err, result) {
      if (err) {
        console.log(err);
      }
      else {
        res.render("historyDelete", { history: result });
      }
    })
  }
  else {
    res.redirect("/");
  }

});

app.get("/historyEdit/:paramUsername", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    const findUsername = req.params.paramUsername;
    LoanHistory.findOne({ username: findUsername }, function (err, result) {
      if (err) {
        console.log(err);
      }
      else {
        res.render("historyEdit", { history: result });
      }
    })
  }
  else {
    res.redirect("/");
  }

});


app.get("/manageLoanOnAdmin", function (req, res) {
  if (req.isAuthenticated() && req.user.id === process.env.ADMIN_KEY) {
    var resultChecked = [];
    LoanOnline.find({}, function (err, result) {

      if (err) {
        console.log(err);
      }
      else {
        // console.log(getDay(result[0].borrowOn.day));
        // console.log(typeof(getDay(result[0].borrowOn.day)));
        // console.log(getCurrentDay());
        // console.log(typeof(getCurrentDay()));
        for (let index = 0; index < result.length; index++) {

          if (getDay(result[index].borrowOn.day) === getCurrentDay()) {
            resultChecked.push(result[index]);
          }

        }
        res.render("manageLoanOnAdmin", { loanOn: resultChecked });
      }
    })
  }
  else {
    res.redirect("/");
  }

});
app.get("/manageLoanOnAdmin/:paramid", function (req, res) {
  const findId = req.params.paramid;
  LoanOnline.findOne({ _id: findId }, function (err, result) {
    const loan2 = new Loan({
      MSSV: result.borrowOn.MSSV,
      studentName: result.borrowOn.studentName,
      phone: result.borrowOn.phone,
      roomName: result.borrowOn.roomName,
      note: result.borrowOn.note,
      day: result.borrowOn.day,
      equipmentList: result.borrowOn.equipmentList
    })
    loan2.save();

    User.findById(req.user.id, function (err, resultForUser) {
      console.log(typeof (resultForUser.username));
      LoanHistory.findOne({ username: resultForUser.username }, function (err, checkUsername) {
        if (err) {
          console.log(err);
        }
        else if (checkUsername) {
          checkUsername.add.push(loan2);
          checkUsername.save();
        }
        else if (!checkUsername) {
          const newLoanHistory = new LoanHistory({
            username: resultForUser.username
          });
          newLoanHistory.add.push(loan2);
          newLoanHistory.save();
        }
      })


    })
  })

  LoanOnline.findOneAndDelete({ _id: findId }, function (err) {
    if (err) {
      console.log(err);
    }
  });
  res.redirect("/manageAdmin");
})

app.get("/AdminLogOut", function (req, res) {
  messageLogin = "";
  req.logout();
  res.redirect("/");
})


app.listen(3000, function () {
  console.log("Server started on port 3000");
});

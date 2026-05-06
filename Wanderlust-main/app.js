require('dotenv').config();





const express = require('express')
const app = express()
app.set("trust proxy", 1);

const port = process.env.PORT || 3030;

const mongoose = require('mongoose');
const Listing = require("./models/listing.js")
const path  = require("path")
const methodOverride=require("method-override")
const ejsMate = require("ejs-mate")
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const Review = require("./models/review.js");
const flash = require("connect-flash")
const review = require('./models/review.js');
const session = require("express-session")
const MongoStore = require('connect-mongo');
const passport = require("passport")
const LocalStrategy = require("passport-local")
const User = require("./models/user.js"); 
const { log } = require('console');
const { isLoggedIn , isOwner,isReviewAuthor} = require("./middleware.js")
const { saveRedirectUrl} = require("./middleware.js")
const geocoder = require("./utils/geocode"); 

const dbUrl = process.env.ATLASDB_URL;
const store = MongoStore.create({
  mongoUrl:dbUrl,
  crypto :{
    secret : process.env.SECRET,
  },
  touchAfter : 24 * 3600
})


store.on("error",(err)=>{
  console.log("ERROR IN MONGO SESSION STORE",err);
  
})


const isProduction = process.env.NODE_ENV === 'production'; // Add this line

const sessionOption ={
  store ,
  secret: process.env.SECRET,
  resave : false,
 saveUninitialized: true,
 cookie : {
   expires :Date.now() + 7 * 24 * 60 * 60 * 1000,
   maxAge :  7 * 24 * 60 * 60 * 1000,
   httpOnly : true,
    secure: isProduction, // Critical for HTTPS
    sameSite: isProduction ? 'none' : 'lax' // Required for cross-site cookies
   
 }
}






app.use(session(sessionOption))
app.use(flash())


app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()))

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());







app.set("view engine","ejs")
app.set("views",path.join(__dirname,"views"))
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"))
app.engine("ejs",ejsMate)
app.use(express.static(path.join(__dirname,"/public")))

app.use((req,res,next)=>{
  res.locals.success = req.flash("success")
   res.locals.error = req.flash("error");
   res.locals.currUser = req.user;
  next()
})






main().then(()=>{
    console.log("connected to DB"); 
})
.catch(err => console.log(err));

async function main() {
 await mongoose.connect(dbUrl);


  // use `await mongoose.connect('mongodb://user:password@127.0.0.1:27017/test');` if your database has auth enabled
}


// logout
app.get("/logout",(req,res,next)=>{
  req.logout((err) =>{
    if(err){next(err)}
    req.flash("success","you are logged out !")
    res.redirect("/listings")
  })
})




app.get("/", (req, res) => {
  res.redirect("/listings"); // or render a home page like "home.ejs"
});



app.get("/listings", async(req,res)=>{
 const allListings = await Listing.find({})
res.render("listings/index.ejs", { allListings });

})


app.get("/listings/new",isLoggedIn,(req,res)=>{
  
    res.render("listings/new.ejs")
})



app.get("/listings/new1",(req,res)=>{
    res.render("listings/new1.ejs")
})


// sign up form
app.get("/signup",(req,res)=>{
   res.render("users/signup.ejs")
})

app.post("/signup",async(req,res)=>{
   console.log("🔥 POST /signup hit");
  console.log("📦 req.body =", req.body);
  try{
    let{username , email , password} = req.body
      console.log("📩 Signup Request Received:", username, email);
  const newUser = new User ({email,username})
  const registeredUser = await User.register(newUser , password)
  // console.log(registeredUser);
  req.login(registeredUser,(err)=>{
    if (err) {
      return next(err);
    }
    req.flash("success","user was registered sucessfully")
  res.redirect("/listings")
  })
  
  
  }
  catch(err){
    req.flash("error",err.message)
    res.redirect("/signup")
  }
})

// login form 
app.get("/login",(req,res)=>{
  res.render("users/login.ejs")
})

app.post("/login", saveRedirectUrl ,passport.authenticate("local",{ failureRedirect : "/login" , failureFlash : true}),async(req,res)=>{
    req.flash("success","Welcome to Wanderlust!")
    let redirectUrl = res.locals.redirectUrl || "/listings"
    res.redirect(redirectUrl)
})













// // CREATE ROUTE
// app.post("/listings", isLoggedIn,
//  wrapAsync(async(req,res,next)=>{
//    // let{title , description , immage , price , country ,locations}= req.body
//   if(!req.body.listing){
//     throw new ExpressError(400,"send vaild data")
//   }
  
//      let newlisting = new Listing(req.body.listing);
//      newlisting.owner = req.user._id;
//    await newlisting.save();
   
//    req.flash("success","New Listing Created")
//    res.redirect("/listings")


// }))
// CREATE ROUTE
app.post("/listings", isLoggedIn,
 wrapAsync(async(req, res, next) => {
  if (!req.body.listing) {
    throw new ExpressError(400, "Send valid data");
  }

  // Step 1: Get location from form
  const { location } = req.body.listing;

  // Step 2: Geocode location to get lat/lng
  const geoData = await geocoder.geocode(location);

  if (!geoData.length) {
    req.flash("error", "Invalid location");
    return res.redirect("/listings/new");
  }

  // Step 3: Create new listing with geocoded data
  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;
  newListing.lat = geoData[0].latitude;
  newListing.lng = geoData[0].longitude;

  await newListing.save();

  req.flash("success", "New Listing Created");
  res.redirect("/listings");
}));



// delete 
app.delete("/listings/:id",isLoggedIn,isOwner,
  wrapAsync(async(req,res)=>{
      let { id} = req.params;
  let dlt =  await  Listing.findByIdAndDelete(id);
  console.log(dlt);
   req.flash("success"," Listing Deleted")
  res.redirect("/listings")
  
}))

//reviewsroute
app.post("/listings/:id/reviews", isLoggedIn , async(req,res)=>{
  let listing  =await Listing.findById(req.params.id)
  let newReview = new Review(req.body.review)
 newReview.author = req.user._id;
  listing.reviews.push(newReview)
  await newReview.save();
  await listing.save();

   req.flash("success","New Review Created")
 res.redirect(`/listings/${listing._id}`);
})





//update route
app.put("/listings/:id" ,isLoggedIn,isOwner,
  wrapAsync(async(req,res)=>{
    let { id} = req.params;
   

  await  Listing.findByIdAndUpdate(id,{...req.body.listing})
   req.flash("success"," Listing Updated")
  res.redirect(`/listings/${id}`)
}))






// edit route
app.get("/listings/:id/edit",isLoggedIn,isOwner,
  wrapAsync(async(req,res)=>{
    let{id}= req.params;
  const listing=  await Listing.findById(id);
    res.render("listings/edit.ejs",{listing})
}))


// show route
app.get("/listings/:id",
  wrapAsync(async(req,res)=>{
    let{id}= req.params;
  const listing=  await Listing.findById(id).populate({
    path: "reviews",
    populate :{
    path : "author"
    },
  }).populate("owner");
console.log(listing);


   // Calculate average rating
    let totalRating = 0;
    if (listing.reviews.length > 0) {
        totalRating = listing.reviews.reduce((sum, review) => sum + review.rating, 0);
    }
    const avgRating = listing.reviews.length ? (totalRating / listing.reviews.length).toFixed(1) : "N/A";

  res.render("listings/test.ejs",{ listing , avgRating})
}))


// delete review route
app.delete("/listings/:id/reviews/:reviewId", isLoggedIn,isReviewAuthor, async (req,res)=>{
      let {id , reviewId }=req.params;
      await Listing.findByIdAndUpdate(id ,{$pull : {reviews : reviewId}})
      Review.findByIdAndDelete(reviewId)
       req.flash("success","Review Deleted")
      res.redirect(`/listings/${id}`)
})


// cookies
app.get("/getcookies",(req,res)=>{
  res.cookie("greet","hello")
  res.send("cookies are send")
})





//ERROR MIDDLEWARE
app.use((err,req,res,next)=>{
  let {statusCode =500 , message="something is wrong"} =err;
  res.status(statusCode).send(message)
})



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
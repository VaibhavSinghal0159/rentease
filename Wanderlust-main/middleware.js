const Listing = require("./models/listing")

module.exports.isLoggedIn = (req,res,next)=>{

    if(!req.isAuthenticated()){
    req.session.redirectUrl = req.originalUrl;
    req.flash("error","You must be logged in to create Listing")
   return  res.redirect("/login")
  }
  next()
}
module.exports.saveRedirectUrl=(req,res,next)=>{
    if(req.session.redirectUrl){
        res.locals.redirectUrl= req.session.redirectUrl;
    }
    next();
}
const Review = require("./models/review");

module.exports.setReviewAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);
    
    if (review && req.user && review.author.equals(req.user._id)) {
        res.locals.ra = true;
    } else {
        res.locals.ra = false;
    }
    next();
}


module.exports.isOwner= async(req,res,next)=>{
      let { id} = req.params;
    let listing = await Listing.findById(id);
    if(!listing.owner.equals(res.locals.currUser._id)){
      req.flash("error","You don't have permission to edit")
      return res.redirect(`/listings/${id}`)
    }
    next()
}
// module.exports.isReviewAuthor= async(req,res,next)=>{
//       let {id, reviewId} = req.params;
//     let review = await Listing.findById(id);
//     if(!review.author.equals(res.locals.currUser._id)){
//       req.flash("error","You don't have permission to DELETE")
//       return res.redirect(`/listings/${id}`)
//     }
//     next()
// }


module.exports.isReviewAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params;

    const review = await Review.findById(reviewId);

    if (!review) {
        req.flash("error", "Review not found");
        return res.redirect(`/listings/${id}`);
    }

    if (!review.author.equals(req.user._id)) {
        req.flash("error", "You do not have permission to delete this review");
        return res.redirect(`/listings/${id}`);
    }

    next();
};

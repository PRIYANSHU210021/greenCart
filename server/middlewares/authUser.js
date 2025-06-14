import jwt from 'jsonwebtoken'
const authUser = async(req,res,next) =>{
    // console.log("req is : ", req.body)
    const {token} = req.cookies;

    if(!token){
        return res.json({success:false, message:'Not Authorized'})
    }
    
    try{
        const tokenDecode = jwt.verify(token,process.env.JWT_SECRET)
        if(tokenDecode.id){
             // Ensure req.body is defined
             req.body = req.body || {}; //  this is not a good practice
             req.body.userId = tokenDecode.id;
        }
        else{
            return res.json({success:false, message:'Not Authorized'})
        }
        next();
    }
    catch(error){
        console.log("error message : ", error)
        res.json({success:false, message: error.message})
    }
}

export default authUser;
var express = require('express');
var router = express.Router();
const databaseMethods = require('../controllers/databaseMethods.js');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/concepts', async (req, res, next) =>{
  databaseMethods.getConcepts(req, res).then(data =>{
    res.status(200).json(data)
  })
  .catch(err =>{
    console.error(err);
  });
});

router.get('/concept-details', async(req, res, next)=>{
  try{
    res.status(200).json(await databaseMethods.getAllConceptsDetails(req,res));
  }
  catch(err){
    console.error(err);
  }
});

router.get('/concept-details/:conceptId', async(req, res, next) =>{
  try{
    return res.status(200).json(await databaseMethods.getConceptDetails(req,res));
  }
  catch(err){
    console.error(err);
  }
});

router.put('/concepts', async(req,res,next)=>{
  try{
    return res.status(200).json(await databaseMethods.updateConcept(req,res));
  }
  catch(err){
    console.error(err);
  }
});

router.post('/concepts', async(req, res, next) =>{
  try{
    let message = await databaseMethods.addConcept(req,res)
    console.log(message);
    return res.status(201).json(message);
  }
  catch(error){
    console.error(error);
  }
});

router.delete('/concepts/:conceptId', async(req,res,next)=>{
  console.log(req.params.conceptId)
  try{
    await databaseMethods.deleteConcept(req, res);
  }
  catch(error){

  }
});

module.exports = router;

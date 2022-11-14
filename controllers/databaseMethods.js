const db = require('./databaseAccess').db;
const pgp = require('./databaseAccess').pgp;
const queries = require('./query.js');

const getConcepts = async (request, response) => {
  try{
    return await db.any('SELECT * FROM concepts');;
  }
  catch(error){
    console.log(error);
    response.status(500);
  }
}

const getAllConceptsDetails = async(request, response) =>{
  let conceptsDetails= await db.one(queries.getConceptsDetailsQuery);
  return {concepts:conceptsDetails["concepts"]};
}

const getConceptDetails = async (request, response) =>{
  try{
    return await db.one(queries.getConceptDetailsQuery, [request.params.conceptId]);
  }
  catch(error){
    console.error(error);
  }
}

const getPostConceptDetails = async (conceptId) =>{
  try{
    return await db.one(queries.getConceptDetailsQuery, [conceptId]);
  }
  catch(err){
    console.error(err);
  };
}

const addConcept = async (request, response) =>{
  let conceptData = request.body;
  try{
    let createdConcept = await tryToCreateConcept(conceptData);
    await tryToCreateAlternateNames(conceptData, createdConcept.conceptId);
    await tryToAssociateParents(conceptData,createdConcept.conceptId);
    await tryToAssociateChildren(conceptData, createdConcept.conceptId);
    return getPostConceptDetails(createdConcept.conceptId);
  }
  catch(error){
    console.error(error);
  }
}

const tryToCreateConcept = async(data) =>{
  if(data["displayName"] !== undefined){
    return await db.one('INSERT INTO CONCEPTS ("displayName", description) VALUES ($1,$2) RETURNING *', [data.displayName, data.description]);
  }
}

const tryToCreateAlternateNames = async(data, conceptId) => {
  if(data["alternateNames"] !== undefined && data["alternateNames"].length >0){
    const columnSet = new pgp.helpers.ColumnSet(['conceptId', 'alternateName'], {table: 'concepts_alternative_names'});
    const query = pgp.helpers.insert(createBulkAlternateNamesData(data, conceptId), columnSet);
    const finalQuery = query+" RETURNING *";
    await db.manyOrNone(finalQuery);
  }
}

const createBulkAlternateNamesData = (data, conceptId) =>{
  let bulkData = [];
  data["alternateNames"].forEach(element => {
    bulkData.push({conceptId:conceptId, alternateName:element.alternateName});
  });
  return bulkData;
}

const tryToAssociateChildren = async(data, conceptId) =>{
  if(dataIncludesChildConcepts(data)){
    const columnSet = new pgp.helpers.ColumnSet(['parentId', 'childId'], {table: 'concepts_children'});
    let bulkData = createBulkChildConceptData(data, conceptId);
    if(bulkData.length !== 0){
      const query = pgp.helpers.insert(bulkData, columnSet);
      await db.none(query);
    }
  }
}

const createBulkChildConceptData = (data, conceptId) =>{
  let bulkData = [];
  data["childConcepts"].forEach(child =>{
    bulkData.push({parentId:conceptId, childId:child.conceptId})
  });
  return bulkData;
}

const dataIncludesChildConcepts = async(data) =>{
  return data["childConcepts"] !== undefined && data["childConcepts"].length !== 0;
}

const tryToAssociateParents = async(data, conceptId)=>{
  if(dataIncludesParentConcepts(data)){
    const columnSet = new pgp.helpers.ColumnSet(['parentId', 'childId'], {table: 'concepts_children'});
    let bulkData = createBulkParentConceptData(data, conceptId);
    if(bulkData.length !== 0){
      const query = pgp.helpers.insert(bulkData, columnSet);
      await db.none(query);
    }
  }
}

const createBulkParentConceptData = (data, conceptId) =>{
  let bulkData = [];
  data["parentConcepts"].forEach(parent =>{
    bulkData.push({parentId:parent.conceptId, childId:conceptId})
  });
  return bulkData;
}


const dataIncludesParentConcepts = (data) =>{
  return data["parentConcepts"] !== undefined && data["parentConcepts"].length !== 0;
}

const updateConcept = async (request, response) =>{
  db.tx(async(t) => {
    let data = request.body;
    let bulkQuery =[];
    const conceptUpdate = tryToUpdateConcept(data, t);
    const alternateNamesUpdate =  tryToUpdateAlternateNames(data,t);
    const newAlternateNames = tryToAddNewAlternateNames(data, t);
    const cleanUpParentConceptsQuery = cleanUpParentConcepts(data,t); 
    const cleanUpChildConceptsQuery = cleanUpChildConcepts(data,t);
    const createConceptRelationsQuery = updateParentAndChildConcept(data, t); 
    return t.batch([conceptUpdate, alternateNamesUpdate, newAlternateNames, cleanUpParentConceptsQuery,cleanUpChildConceptsQuery,createConceptRelationsQuery]);
  })
  .then((data)=>{
    console.log("success");
    console.log(data);
  })
  .catch((err) =>{
    console.error(err);
  });
}

const tryToUpdateConcept = (data,tx) =>{
  if(data["displayName"] !== undefined){
    return tx.none('UPDATE CONCEPTS SET "displayName"=$1, description=$2 where "conceptId"=$3', [data.displayName, data.description, data.conceptId]);
  }
}

const tryToUpdateAlternateNames =  (data,t) =>{
  if(data["alternateNames"] !== null && data["alternateNames"] !== undefined || data["alternateNames"].length >0){
    return updateExistingAlternateNames(data, t);
  }
}

const updateExistingAlternateNames = (data, t) =>{
  const columnSet = new pgp.helpers.ColumnSet(['alternateName', '?conceptId', "?alternateNameId"], {table: 'concepts_alternative_names'});
  let bulkData = updateBulkAlternateNamesData(data, data["conceptId"]);
  if(bulkData.length > 0){
    const query = pgp.helpers.update(bulkData, columnSet) + 'WHERE v."conceptId"= t."conceptId" and v."alternateNameId"=t."alternateNameId"';
    return t.manyOrNone(query);
  }
}

const updateBulkAlternateNamesData = (data, conceptId) =>{
  let bulkData = [];
  data["alternateNames"].forEach(name =>{
    if(name.hasOwnProperty("alternateNameId")){
      if(!name.hasOwnProperty("conceptId")){
        name["conceptId"] = conceptId;
      }
      bulkData.push(name);
    }
  });
  return bulkData
}

const tryToAddNewAlternateNames =  (data, t) =>{
  if(data["alternateNames"] === null && data["alternateNames"] !== undefined && data["alternateNames"].length > 0){
    return addNewAlternateNames(data,t);
  }
}

const addNewAlternateNames = (data, t) =>{
  const columnSet = new pgp.helpers.ColumnSet(['conceptId', 'alternateName'], {table: 'concepts_alternative_names'});
  let bulkData = createAdditionalAlternateNamesData(data);
  if(bulkData.length > 0){
    const query = pgp.helpers.insert(bulkData, columnSet);
    return t.manyOrNone(query);
  }
}

const createAdditionalAlternateNamesData = (data, t) =>{
  let bulkData = [];
  data["alternateNames"].forEach(name =>{
    if(!name.hasOwnProperty("alternateNameId")){
      name.conceptId = data["conceptId"];
      bulkData.push(name);
    }
  });
  return bulkData;
}


const cleanUpParentConcepts = (data,tx)=>{
  let conceptId = data["conceptId"];
  return tx.none('DELETE FROM concepts_children where "childId"=$1', [conceptId]);
}

const cleanUpChildConcepts = (data,tx) =>{
  let conceptId = data["conceptId"];
  return tx.none('DELETE FROM concepts_children where "parentId"=$1', [conceptId]);
}

const updateParentAndChildConcept = (data, tx)=>{
  let conceptId = data["conceptId"];
  let bulkData = [];
  addChildConcepts(bulkData, data, conceptId);
  addParentConcepts(bulkData,data,conceptId);
  if(bulkData !== null && bulkData.length > 0 ){
    const columnSet = new pgp.helpers.ColumnSet(['parentId', 'childId'], {table: 'concepts_children'});
    const query = pgp.helpers.insert(bulkData, columnSet);
    return tx.manyOrNone(query);
  }
}

const addParentConcepts = (bulkData, data, conceptId) =>{
  if(data["parentConcepts"] !== null && data["parentConcepts"] !== undefined && data["parentConcepts"].length > 0){
    data["parentConcepts"].forEach(concept =>{
      bulkData.push({parentId:concept.conceptId, childId:conceptId});
    });
  }
}

const addChildConcepts = (bulkData, data, conceptId) =>{
  if(data["childConcepts"] !== null && data["childConcepts"] !== undefined && data["childConcepts"].length > 0){
    data["childConcepts"].forEach(concept =>{
      bulkData.push({parentId:conceptId, childId:concept.conceptId});
    });
  }
}

const deleteConcept = async(request, response) => {

  db.tx((t) => {
    let data = request.body;
    const deleteAlternativeNames = db.none('DELETE FROM concepts_alternative_names where "conceptId"=$1', [request.params.conceptId]);
    const deleteChildObjects = db.none('DELETE FROM concepts_children where "parentId"=$1', [request.params.conceptId]);
    const deleteParentObjects =  db.none('DELETE FROM concepts_children where "childId"=$1', [request.params.conceptId]);
    const deleteConcept =  db.none('DELETE FROM concepts where "conceptId"=$1', [request.params.conceptId]);
    return t.batch([deleteAlternativeNames,deleteChildObjects, deleteParentObjects, deleteConcept]);
  })
  .then((data) =>{
    console.log("deleted");
  })
  .catch((error) =>{
    console.log(error);
  });
  response.status(200).send();
}

exports.getConcepts = getConcepts;
exports.addConcept = addConcept;
exports.deleteConcept = deleteConcept;
exports.getConceptDetails = getConceptDetails;
exports.updateConcept = updateConcept;
exports.getAllConceptsDetails = getAllConceptsDetails;
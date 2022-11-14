const getConceptDetailsQuery = `select 
  row_to_json(concepts) as concept
from 
  (
    SELECT 
      b."conceptId", 
      b."displayName", 
      b.description, 
      (
        select 
        json_agg(row_to_json(a.*)) as "alternateNames"
        from 
          CONCEPTS_ALTERNATIVE_NAMES a 
        where 
          a."conceptId" = b."conceptId"
      ), 
      (
        select 
          json_agg(
            row_to_json(c)
          ) as "childConcepts" 
        from 
          concepts c 
          inner join concepts_children e on e."parentId" = b."conceptId" 
        where 
          c."conceptId" = e."childId"
      ), 
      (
        select 
          json_agg(
            row_to_json(d)
          ) as "parentConcepts" 
        from 
          concepts d 
          INNER JOIN concepts_children e on e."childId" = b."conceptId" 
        where 
          d."conceptId" = e."parentId"
      ) 
    from 
      concepts b
  ) as concepts 
where 
  concepts."conceptId" = $1;`;

const getConceptsDetailsQuery =`select 
json_agg(concepts) as concepts
from 
(
  SELECT 
    b."conceptId", 
    b."displayName", 
    b.description, 
    (
      select 
        json_agg(row_to_json(a.*)) as "alternateNames"
      from 
        CONCEPTS_ALTERNATIVE_NAMES a 
      where 
        a."conceptId" = b."conceptId"
    ), 
    (
      select 
        json_agg(
          row_to_json(c)
        ) as "childConcepts" 
      from 
        concepts c 
        inner join concepts_children e on e."parentId" = b."conceptId" 
      where 
        c."conceptId" = e."childId"
    ), 
    (
      select 
        json_agg(
          row_to_json(d)
        ) as "parentConcepts" 
      from 
        concepts d 
        INNER JOIN concepts_children e on e."childId" = b."conceptId" 
      where 
        d."conceptId" = e."parentId"
    ) 
  from 
    concepts b
) as concepts 
`

module.exports.getConceptDetailsQuery = getConceptDetailsQuery;
module.exports.getConceptsDetailsQuery = getConceptsDetailsQuery;

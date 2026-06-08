
import connection from "../db.js";

async function slugValidation(request, response, next) {
  let rawPosts = [];
  try {
    const [results] = await connection.execute('SELECT * FROM `posts`');
    rawPosts = results;
    console.log(rawPosts);
    
  } catch (error) {
    throw error;
  }
  
  const slug = (request.params.slug).trim();

  if (slug === '') {
    console.log('empty slug error');

    response.status(400).json({
      message: "Lo slug non può essere vuoto"
    });
    return;
  }

  if (isNaN(Number(slug))) { //se slug non è un numero
    console.log('string as slug error');
    response.status(400).json({
      message: "Lo slug deve essere un numero"
    });
    return;
  }

  const searchedPost = rawPosts.find(post => {
        return post.id === Number(slug);
    });
    
  request.searchedPost = searchedPost;
  
  const patchingId = rawPosts.findIndex((post) => {return post.id === Number(slug)});
  request.patchingId = patchingId + 1; //questo mi serve solo nel caso della patch
  request.searchedId = patchingId + 1; //questo mi serve solo nel caso della show
  
  request.deletingId = patchingId + 1; //questo mi serve solo nel caso della delete

  if (patchingId === -1){
    response.status(404).json({
      message: 'post non trovato'
    })
  }
  

  next();
}

async function postValidation(request, response, next) {
  let rawPosts = [];
  try {
    const [results] = await connection.execute('SELECT * FROM `posts`');
    rawPosts = results;
    console.log(rawPosts);
    
  } catch (error) {
    throw error;
  }
  const { id, created_at, published, slug, ...rest } = rawPosts[0]; //mi serve l'oggetto senza slug per la validazione
  const validImgFormats = ["jpg", "jpeg", "png", "webp", "gif", "svg", "tif", "tiff"];


  for (let prop in request.body) { //se si inserisce una proprietà non valida
    if (rest.hasOwnProperty(prop)) {

      continue;
    } else {
      response.status(400).json({
        message: `Non puoi inserire '${prop}' come proprietà`
      });
      return;
    }
  }

  if (Object.keys(request.body).length !== Object.keys(rest).length) { //se non ci sono tutte le proprietà
    response.status(400).json({
      message: `Mancano una o più proprietà`
    });
    return;
  }



  const splittedImgUrl = request.body.image.split('.');

  if (!validImgFormats.includes(splittedImgUrl[splittedImgUrl.length - 1])) {
    response.status(400).json({
      message: `Inserisci un formato immagine tra quelli supportati: 'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'tif', 'tiff'`
    });
    return;
  }

  if (typeof request.body.tags !== 'object' || request.body.tags.length === 0) {
    response.status(400).json({
      message: `Il valore di 'tags' deve essere un array di stringhe non vuoto`
    });
    return;
  }

  request.body.tags.forEach(tag => {
    if (typeof tag !== 'string') {
      response.status(400).json({
        message: `Puoi inserire solo stringhe all'interno di 'tags'`
      });
      return;
    }
  });

  if (typeof request.body.prep_time !== 'number') {
    response.status(400).json({
      message: `Il valore di 'prep_time' deve essere un numero`
    });
    return;
  }

  const sortedByIndex = rawPosts.toSorted(function (a, b) { return b.id - a.id });

  const newPostId = sortedByIndex[0] + 1;
  const date = new Date();
  const newPostDay = date.toLocaleDateString();
  const newPostTime = date.toLocaleTimeString();
  const newPostDate = `${newPostDay}T${newPostTime}Z`;
  const rawSlugArr = request.body.title.split(' ');
  let newPostSlug;

  newPostSlug = rawSlugArr.filter(current => {
    return current !== '';
  }).join('-').toLowerCase();

  let slugCounter = 1;
  let tempSlug = newPostSlug;                                                                          //positionToUpdate
  const positionToUpdate = rawPosts.findIndex((post) => { return post.slug === request.params.slug }); //serve per sovrascrivere il post precedente
  console.log(positionToUpdate);

  rawPosts.forEach(post => {
    if (tempSlug === post.slug) {
      tempSlug = `${newPostSlug}-${slugCounter}`;
      slugCounter++;
    }
  })

  newPostSlug = tempSlug;

  const newPost = {
    ...request.body,
    id: newPostId,
    created_at: newPostDate,
    slug: newPostSlug,
    published: true
  }

  request.newPost = newPost; //passo i dati tramite l'oggetto della request alla funzione successiva
  request.positionToUpdate = positionToUpdate;
  next();
}

export { slugValidation, postValidation };
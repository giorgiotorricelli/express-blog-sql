import { response } from "express";
import connection from "../db.js";


function multipleTagsSearch(stricts, flexibles, posts, response) {
    if (stricts.length > 1 && flexibles.length > 1) { //nel caso l'utente inserisca ',' e '||' insieme
        response.status(400).json({
            message: `Non puoi utilizzare strict mode e flexible mode insieme`
        });
        return resp;
    }
    if (stricts.length > 1) {
        const tagSearch = posts.filter(post => {
            const tagsLower = post.tags.map(tag => {
                return tag.toLowerCase();
            })
            return stricts.every(element => {
                return tagsLower.includes(element)
            });
        });
        response.status(200).json({
            message: `Ecco la lista dei post contenenti OGNI tag inserito (strict mode)`,
            posts: tagSearch
        });
    } else if (flexibles.length > 1) {
        const tagSearch = posts.filter(post => {
            const tagsLower = post.tags.map(tag => {
                return tag.toLowerCase();
            })
            return flexibles.some(element => {
                return tagsLower.includes(element)
            });
        });
        response.status(200).json({
            message: `Ecco la lista dei post contenenti ALMENO UNO dei tag inseriti (flexible mode)`,
            posts: tagSearch
        });
    }
}

async function index(request, response) {
    let rawPosts = [];
    try {
        const [results] = await connection.execute(`SELECT 
                                                    p.id, 
                                                    p.title, 
                                                    p.content,
                                                    p.image,
                                                    GROUP_CONCAT(t.label SEPARATOR ',') AS tags
                                                    FROM posts p
                                                    LEFT JOIN post_tag pt ON p.id = pt.post_id
                                                    LEFT JOIN tags t ON pt.tag_id = t.id
                                                    GROUP BY p.id;`);
        rawPosts = results.map(post => {
            return {...post,
                tags: post.tags.split(',')
            }
        });
        console.log(results);

    } catch (error) {
        throw error;
    }

    const posts = rawPosts.map(post => {
        const { id, ...rest } = post;
        return rest;
    });


    if (request.query.tags !== undefined) {

        const multipleTagsStrict = request.query.tags.split(',').map(element => {
            return element.trim();
        });
        const multipleTagsFlexible = request.query.tags.split('||').map(element => {
            return element.trim();
        });


        if (multipleTagsStrict.length === 1 && multipleTagsFlexible.length === 1) {
            const tagSearch = posts.filter(post => {
                const tagsLower = post.tags.map(tag => {
                    return tag.toLowerCase();
                })
                return tagsLower.includes(request.query.tags);
            });
            response.status(200).json({
                message: "Ecco la lista dei post contenenti il tag",
                posts: tagSearch
            });
        } else {
            multipleTagsSearch(multipleTagsStrict, multipleTagsFlexible, posts, response);
            return;
        }
    }
    if (request.query.sort_quicker !== undefined) {
        const sortQuick = posts.toSorted(function (a, b) { return a.prep_time - b.prep_time });

        response.status(200).json({
            message: "Ecco la lista dei post in ordine di prep time (dal più veloce)",
            posts: sortQuick
        });
        return;

    }

    if (request.query.sort_slower !== undefined) {
        const sortSlow = posts.toSorted(function (a, b) { return b.prep_time - a.prep_time });

        response.status(200).json({
            message: "Ecco la lista dei post in ordine di prep time (dal più dispendioso)",
            posts: sortSlow
        });
        return;

    }


    const generalQuery = { ...request.query };

    for (let i in generalQuery) {
        if (generalQuery[i] === '') {
            response.status(400).json({
                message: "Valore della query errato"
            });
            return;
        }
    }


    response.status(200).json({

        message: "Ecco la lista dei post",
        posts: posts
    });
}


async function show(request, response) {
    const searchedPost = request.searchedPost;

    const searchedId = request.searchedId;

    const queryShowSql = `SELECT t.label
                            FROM posts AS p
                            JOIN post_tag AS pt
                            ON p.id = pt.post_id
                            JOIN tags AS t
                            ON t.id = pt.tag_id
                            WHERE p.id = ${searchedId};`

    const [results] = await connection.execute(queryShowSql);
    const tags = results.map(tag => {
        return tag.label;
    })


    if (searchedPost) {
        response.status(200).json({
            message: "Ecco il post che cercavi",
            post: {
                ...searchedPost,
                tags
            }
        })
    } else {
        response.status(404).json({
            message: "Post non trovato"
        })
    }

}



async function create(request, response) {
    const newPost = request.newPost; //lo prendo dal middleware di validation

    try {
        const querySQL = `INSERT INTO posts (title, content, image) VALUES (?, ?, ?)`;

    await connection.execute(querySQL, [newPost.title, newPost.content, newPost.image]);
    } catch (error) {
        throw error;
    }
    

    response.status(204);
}

function update(request, response) {
    const updatedPost = request.newPost;
    const positionToUpdate = request.positionToUpdate; //prendo i dati dal middleware di validation

    rawPosts.splice(positionToUpdate, 1, updatedPost);



    response.status(200).json({
        message: `post updatato`
    })
}


async function modify(request, response) { 
    return;
}

async function destroy(request, response) {
    const deletingId = request.deletingId;

    console.log(deletingId);

    try {
        connection.execute(`DELETE FROM posts WHERE posts.id = ${deletingId} `);
        response.status(204).json({
            message: `post con slug: ${request.params.slug} eliminato`
        });
    } catch (error) {
        response.status(404).json({
            message: 'post non trovato'
        })
    }
    // rawPosts.splice(deletingId, 1);

}



export { index, show, create, update, modify, destroy }
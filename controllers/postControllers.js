import { response } from "express";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, createAgent, tool } from "langchain";
import { z } from 'zod';
import connection from "../db.js";

//modifiedByClaude(request, searchedPost)

function modifiedByClaude({ request, searchedPost }) {
    console.log(`Sto modificando`);
    return postModifiedByClaude;
}

const claudeModifyTool = tool(modifiedByClaude, {
    name: "claude_modify_tool",
    description: "Tool avente l'utilità di modificare un oggetto json",
    schema: z.object({
        request: z.string().describe("La richiesta dell'utente, ovvero la ricetta da cercare per andare a modificare la ricetta precedente"),
        searchedPost: z.object().describe("L'oggetto precedente (ricetta) il quale vanno modificate le proprietà: id, title, content, image, tags, published (passalo sempre a true), slug, prep_time, created_at (toISOString())")
    })
});

const model = new ChatAnthropic({
    model: 'claude-sonnet-4-6',
    apiKey: process.env.CLAUDE_API_KEY
});

const agent = createAgent({
    model,
    tools: [claudeModifyTool]
});



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
        const [results] = await connection.execute('SELECT * FROM `posts`');
        rawPosts = results;
        console.log(results);

    } catch (error) {
        throw error;
    }

    const posts = rawPosts.map(post => {
        const { id, created_at, published, ...rest } = post;
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


function show(request, response) {
    const searchedPost = request.searchedPost;


    if (searchedPost) {
        response.status(200).json({
            message: "Ecco il post che cercavi",
            post: searchedPost
        })
    } else {
        response.status(404).json({
            message: "Post non trovato"
        })
    }

}



function create(request, response) {
    const newPost = request.newPost; //lo prendo dal middleware di validation

    rawPosts.push(newPost);

    response.status(201).json({
        message: `Post creato correttamente con slug: '${newPost.slug}'`
    });
}

function update(request, response) {
    const updatedPost = request.newPost;
    const positionToUpdate = request.positionToUpdate; //prendo i dati dal middleware di validation

    rawPosts.splice(positionToUpdate, 1, updatedPost);



    response.status(200).json({
        message: `post updatato`
    })
}

async function gestisciAgente(requestForClaude, searchedPost) {
    const response = await agent.invoke({
        messages: [
            new HumanMessage(`
                Agisci come un assistente che modifica ricette.
                
                L'oggetto originale da modificare è:
                ${JSON.stringify(searchedPost, null, 2)}

                La richiesta di modifica dell'utente è:
                "${requestForClaude}"

                Usa il tool 'claude_modify_tool' per effettuare la modifica richiesta e restituisci ESCLUSIVAMENTE il JSON del post modificato e NIENT'ALTRO.
            `),
        ],
    });

    // Recuperiamo l'ultimo messaggio dell'agente (la risposta di Claude o l'output del tool)
    const finalMessage = response.messages[response.messages.length - 1].content;
    return finalMessage;
}

async function modify(request, response) { // <--- Aggiunto async
    try {
        const searchedPost = request.searchedPost;
        const patchingId = request.patchingId;
        const requestForClaude = request.body.message;
        const sortedByIndex = rawPosts.toSorted(function (a, b) { return b.id - a.id });
        const newPostId = sortedByIndex[0].id + 1;

        if (!requestForClaude) {
            return response.status(400).json({ message: "Manca il messaggio per Claude nel body" });
        }

        // Attendiamo che Claude faccia il suo lavoro
        const resultFromClaude = await gestisciAgente(requestForClaude, searchedPost);

        console.log("Risultato di Claude:", resultFromClaude);

        const cleanJsonString = resultFromClaude
            .replace(/^```json\s*/i, '')  // Rimuove ```json all'inizio (case-insensitive)
            .replace(/^```\s*/i, '')      // Rimuove ``` all'inizio se manca la parola 'json'
            .replace(/```$/, '')          // Rimuove ``` alla fine
            .trim();                      // Rimuove spazi bianchi o a capo extra


        const updatedPost = JSON.parse(cleanJsonString);
        const updatedPostPlusId = {
            ...updatedPost,
            id: newPostId
        }
        rawPosts.splice(patchingId, 1, updatedPostPlusId);

        console.log(rawPosts);





        // Per ora simuliamo il successo basandoci sulla risposta ricevuta
        response.status(200).json({
            message: `Post con slug ${searchedPost.slug} elaborato da Claude`
        });

    } catch (error) {
        console.error("Errore durante la modifica con Claude:", error);
        response.status(500).json({ message: "Errore interno dell'agente AI" });
    }
}

async function destroy(request, response) {
    const deletingId = request.deletingId;

    console.log(deletingId);

    try {
        connection.execute(`DELETE FROM posts WHERE posts.id = ${deletingId + 1} `);
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
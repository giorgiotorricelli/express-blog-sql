

function notFound(request, response) {
    response.status(404).json({
        message: 'rotta non trovata'
    })
}

export default notFound;
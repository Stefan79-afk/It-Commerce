const ERROR_CODES = {
    400: "VALIDATION_ERROR",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "RESOURCE_NOT_FOUND",
    409: "CONFLICT",
    500: "INTERNAL_ERROR",
};

export default function errorHandler(err, req, res, next) {
    const status = err.status ?? err.statusCode ?? 500;
    res.status(status).json({
        timestamp: new Date().toISOString(),
        status,
        error: ERROR_CODES[status] ?? "INTERNAL_ERROR",
        message: status < 500 ? err.message : "An unexpected error occurred.",
        path: req.originalUrl,
    });
}

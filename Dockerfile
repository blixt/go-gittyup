FROM golang:1.23.2-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o gittyup ./examples/gittyup

FROM alpine:latest
RUN apk add --no-cache git
RUN adduser -D -g '' appuser
RUN mkdir /app /app/static /app/repos
COPY --from=builder /app/gittyup /app/
COPY examples/gittyup/static /app/static
RUN chown -R appuser:appuser /app
USER appuser
WORKDIR /app
EXPOSE 8080
CMD ["./gittyup"]

# ADR 001: One Next.js application, no separate backend service

Status: accepted, 9 August 2026
Decision by: Jason (technical lead)

## Context

The project description names React/Next.js, Python and FastAPI in its skill
set, which reads as an invitation to build a Next.js front end talking to a
Python API. The tech stack note recommends a single Next.js application instead,
and Sai's scaffold already is one.

Four of the five of us have not shipped a web application before, and there are
eight development weeks.

## Decision

One Next.js application. The interface, the route handlers and the database
access all live in the same project and deploy as one thing. No Python service.

## Why

A second service is not one decision, it is a permanent tax: two repositories or
two folders to keep in step, two dependency sets, two deployments, a network
boundary to authenticate across, CORS, and a second set of types that has to be
kept identical to the first by hand. Every one of those costs a beginner more
than it costs an experienced team, and none of them buys us anything at this
size.

The one honest argument for Python is that the AI ecosystem lives there. It does
not apply here: we call a vision model over HTTP with an image and a prompt, and
that is a `fetch` in any language. Nothing in Module 1 needs numpy.

The project description lists a skill set, not an architecture. Using Next.js
route handlers does not fail it; a half-finished two-service system would.

## Consequences

- Extraction runs inside a route handler. Long readings are handled by
  answering immediately and letting the interface poll, not by holding a request
  open. See ADR 004.
- If extraction ever needs to run for minutes rather than seconds, this decision
  gets revisited and a queue appears. It is not needed at ten seconds.
- Anything the browser must not see is marked `server-only`, which turns a leak
  into a build error rather than a discovery.

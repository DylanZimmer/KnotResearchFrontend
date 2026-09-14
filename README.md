# KnotResearch Frontend

The frontend for KnotResearch, an interactive research tool for exploring knots and studying the behavior of knot invariants.

## Overview

The KnotResearch frontend provides an interactive interface for exploring knots and their diagrams.

Knots are represented using structured data describing their crossings, strands, orientations, and connectivity. The frontend uses this data to render manipulatable knot diagrams rather than treating diagrams as static images.

Users can navigate through knots from the Rolfsen table and inspect their corresponding diagrams and invariant data.

The frontend communicates with a Spring Boot REST API that provides knot and diagram data and coordinates the application's backend operations.

## Current Features

### Knot Exploration

* Browse knots from the Rolfsen table up to 13 crossings
* Navigate between knots
* Generate and display oriented knot diagrams
* Inspect associated knot data and invariants

### Diagram Visualization

Knot diagrams are generated from structured crossing and strand data.

The frontend renders the diagram based on the mathematical representation provided by the backend, allowing the application to work with the diagram as an underlying data structure rather than simply displaying an image.

### Invariant Display

The application displays computed knot invariants associated with the knots being explored.

This provides the foundation for comparing invariants as knots and their diagrams are manipulated.

## Technology

* React
* TypeScript
* Vite
* Tailwind CSS

## Application Architecture

The frontend is responsible for the user interface and visualization layer. It communicates with the KnotResearch backend through REST APIs.

See the https://github.com/DylanZimmer/KnotResearchBackend repository for backend architecture, database design, and API documentation.

The frontend is deployed on Netlify.

**Live application:** https://knotresearch.netlify.app

# MVC Architecture (Sound-Station)

This folder introduces a clear MVC layer without breaking existing modules.

## Structure

- controller
  - App bootstrap and orchestration logic
- model
  - Domain entities, interfaces, and persistence/service exports
- view
  - UI components and feature views exports

## Notes

- Existing folders (core, components, features, services, interfaces, models) remain for compatibility.
- New code should prefer importing from MVC aliases:
  - @controller/*
  - @model/*
  - @view/*
  - @mvc/*

## Entry point

- `src/main.ts` now delegates startup to `src/mvc/controller/AppController.ts`.

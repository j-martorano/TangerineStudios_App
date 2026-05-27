-- Agrega el tipo 'pack' al enum de tipos de proyecto.
-- La migración del UPDATE va en un archivo separado por la restricción de
-- PostgreSQL: no se puede usar un valor nuevo del enum en la misma transacción.

alter type public.project_type add value if not exists 'pack';

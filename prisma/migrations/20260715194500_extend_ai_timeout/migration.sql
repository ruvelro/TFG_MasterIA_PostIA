-- Eleva instalaciones con la ventana antigua; respeta configuraciones ya superiores.
UPDATE "AppSetting"
SET "value" = '300000', "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'ai_timeout_ms'
  AND CAST("value" AS INTEGER) < 300000;

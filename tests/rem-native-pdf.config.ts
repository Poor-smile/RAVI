import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'rem-native-pdf.spec.ts',workers:1,timeout:240000,expect:{timeout:15000},reporter:[['line']],outputDir:'../outputs/rem-01/native',use:{trace:'retain-on-failure'}});

import { defineConfig } from '@playwright/test';
import { playwrightWorkerServer } from './playwright-worker-server';
export default defineConfig({testDir:'.',testMatch:'rem-fidelity.spec.ts',workers:1,timeout:90000,expect:{timeout:15000},reporter:[['line']],outputDir:'../outputs/rem-03/app-before',
 use:{channel:'chrome',baseURL:'http://127.0.0.1:3148',trace:'retain-on-failure'},webServer:playwrightWorkerServer(3148,'.wrangler/rem-fidelity.log'),
 projects:[{name:'light-laptop',use:{viewport:{width:1280,height:914}}},{name:'dark-laptop',use:{viewport:{width:1280,height:914}}},{name:'light-wide',use:{viewport:{width:1600,height:1000}}},{name:'dark-wide',use:{viewport:{width:1600,height:1000}}}]});

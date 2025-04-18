// Set up global Jest functions for ESM modules
import { jest } from '@jest/globals';
global.jest = jest;
global.expect = expect;
global.describe = describe;
global.it = it;
global.beforeEach = beforeEach;
global.afterEach = afterEach;
global.beforeAll = beforeAll;
global.afterAll = afterAll;
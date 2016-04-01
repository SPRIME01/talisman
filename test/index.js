/*jslint node, es6, maxlen: 120 */

'use strict';
// jquery-like api for navigating the dom of html generated by the templating engine
const dom = require("cheerio");
const escapeHtml = require("escape-html");
const promisify = require("es6-promisify");
const readFile = promisify(require('fs').readFile);
const path = require("path");
const stream = require("stream");

const template = require("../lib/talisman").testMode(); //testMode() exposes private implementation methods
const priv = template.testFunctions; // easier access to private implementation methods

// Read the template file
const htmlPromise = readFile(path.join(__dirname, "testTemplate.html"), 'utf8');
// read a file full of random strings
const randomPromise = readFile(path.join(__dirname, "random.html"), 'utf8');

function contentParsingTest(test) {
    test.expect(12);

    const testContent = function (inputString, regexType) {
        // Parse the file for blocks
        const contentArray = priv.parseForTags(inputString, priv[regexType], []);

        test.ok(Array.isArray(contentArray), "Result is an array");

        // Test that the array is correctly formatted
        let contentTypesOk = true;
        let contentObjectsOk = true;
        contentArray.forEach(function (element) {
            if (typeof element !== 'string' && typeof element !== 'object') {
                contentTypesOk = false;
            }
            if (typeof element === 'object') {
                //Determine whether we are testing for a block or a variable tag based on the regex
                if (regexType === 'blockRegex' && (!element.name || !element.text || !element.content)) {
                    contentObjectsOk = false;
                }
                if (regexType === 'blockRegex' && element.content) {
                    if (!Array.isArray(element.content)) {
                        contentObjectsOk = false;
                    }
                }
                if (regexType === 'tagRegex' && (!element.name || !element.text || element.content)) {
                    contentObjectsOk = false;
                }
                if (regexType === 'tagRegex' && element.content) {
                    contentObjectsOk = false;
                }
            }
        });
        test.ok(contentTypesOk, "Array contains only strings and objects.");
        test.ok(contentObjectsOk, "Objects in the array are correctly formatted.");
    };
    // Test the function on the valid html template
    htmlPromise.then(function (templateString) {
        testContent(templateString, 'blockRegex');
        testContent(templateString, 'tagRegex');
    }).catch(function (err) {
        console.error(err);
    });
    // Test the function on a file full of random strings.
    randomPromise.then(function (templateString) {
        testContent(templateString, 'blockRegex');
        testContent(templateString, 'tagRegex');
    }).catch(function (err) {
        console.error(err);
    });

    Promise.all([htmlPromise, randomPromise]).then(function () {
        test.done();
    });
}



function templateInterfaceTest(test) {
    // Establish that the correct methods are exposed in the API
    const expectedTemplateMethods = [
        "create",
        "debug",
        "showUndefined"
    ];

    test.expect(expectedTemplateMethods.length);

    expectedTemplateMethods.forEach(function (method) {
        test.ok(template[method]);
    });
    test.done();
}

template.debug(false);
function testCreateInvalidTemplate(test) {
    const invalidTemplate = template.create('invalid');

    // Rendering an invalid template will result in an error being sent to the browser
    let htmlResult = '';
    invalidTemplate.render()
        .on('data', function (chunk) {
            htmlResult += chunk.toString();
        })
        .on('end', function () {
            // Check that the string being sent to the browser contains the word 'Error'
            test.expect(1);
            test.ok(htmlResult.indexOf('Error') !== -1);
            test.done();
        });
}

const testFile = path.join(__dirname, "testTemplate.html");


function testCreateValidTemplate(test) {
    // Establish that the correct methods are exposed within the context of the template
    const expectedContextMethods = [
        "load",
        "error",
        "set",
        "showUndefinedBlock",
        "remove",
        "restore",
        "addMask",
        "render",
        "test"
    ];

    // Set template path to current directory so that we can correctly retrieve
    const testTemplate = template.create(testFile);

    test.expect(expectedContextMethods.length + 1);
    expectedContextMethods.forEach(function (method) {
        test.ok(testTemplate[method]);
    });
    let htmlResult = '';
    testTemplate.render()
        .on('data', function (chunk) {
            htmlResult += chunk.toString();
        })
        .on('end', function () {
            const $ = dom.load(htmlResult);
            test.ok($('html').html());
            test.done();
        });
}

// Strings to be returned by test promises and streams.
const returnStrings = {};
returnStrings.testPromise1Text = "This text was returned from a promise";
returnStrings.readableMessage = "This text was arrived via a Readable Stream.";
returnStrings.duplexMessage = "This text was arrived via a Duplex Stream.";
returnStrings.transformMessage = "This text was arrived via a Transform Stream.";

// Variables of all types to be used in trying to break various functions and methods.
const testVariables = {};
testVariables.testString1 = "TestString";
testVariables.testNumber1 = 7790.25;
testVariables.testArray1 = ["Melons", "Apples", "Bananas", "Oranges", "Plums"];
testVariables.testObject1 = {testKey1: "value1", testKey2: "value2"};
const testObjectSize = Object.keys(testVariables.testObject1).length;
testVariables.testReadableStream1 = new stream.Readable();
testVariables.testDuplexStream1 = new stream.Duplex();
testVariables.testTransformStream1 = new stream.Transform();
testVariables.testPromise1 = new Promise(function (resolve) {
    setTimeout(resolve, 500, returnStrings.testPromise1Text);
});
testVariables.testFunction1 = function () {
    return "Function Returned";
};
const numberOfTestVariables = Object.keys(testVariables).length;
// Set up _read properties on the streams
const dummyReadMethod = function () {
    // It is necessary to define a _read function for the stream, however in our implementation we are pushing
    // items onto the stream directly so this function is not needed. If this function is not defined then you will
    // be spammed with 'not implemented' errors.
    return undefined;
};
testVariables.testReadableStream1._read = dummyReadMethod; // _read is a bad property name according to JSLint
testVariables.testDuplexStream1._read = dummyReadMethod; // _read is a bad property name according to JSLint
testVariables.testTransformStream1._read = dummyReadMethod; // _read is a bad property name according to JSLint

// Send stuff through the streams and close them.
testVariables.testReadableStream1.push(returnStrings.readableMessage);
testVariables.testDuplexStream1.push(returnStrings.duplexMessage);
testVariables.testTransformStream1.push(returnStrings.transformMessage);
testVariables.testReadableStream1.push(null);
testVariables.testDuplexStream1.push(null);
testVariables.testTransformStream1.push(null);

// This function tests all variable types being entered into a specified function
const tryAllVariableTypes1 = function (func, testInput) {
    const errors = [];
    const successes = [];
    let total = 0;
    const varKeys = Object.keys(testInput);
    varKeys.forEach(function (key) {
        total += 1;
        const variable = testInput[key];
        try {
            func(variable);
            successes.push(variable); // This line shouldn't be reached if there is an exception
        } catch (err) {
            errors.push(err);
        }
    });
    return {successes, errors, total};
};

// This function tests a function that takes two parameters by trying to enter every type of variable into it.
const tryAllVariableTypes2 = function (func, testInput) {
    const errors = [];
    const successes = [];
    let total = 0;
    const varKeys = Object.keys(testInput);
    varKeys.forEach(function (key1) {
        const variable1 = testInput[key1];
        varKeys.forEach(function (key2) {
            total += 1;
            const variable2 = testInput[key2];
            try {
                func(variable1, variable2);
                successes.push([typeof variable1, typeof variable2]); // This line shouldn't be reached if there is an exception
            } catch (err) {
                errors.push([typeof variable1, typeof variable2]);
            }
        });
    });
    return {successes, errors, total};
};

// template.load() can be called with one argument, a string representing a path to a file to load. The block name is
// taken to be the same as the filename
function testTemplateLoad1(test) {
    const testTemplate = template.create(testFile);
    const results = tryAllVariableTypes1(testTemplate.load, testVariables);

    const numberOfExpectedSuccesses = 1; // Only string is a valid input.
    const numberOfExpectedErrors = results.total - numberOfExpectedSuccesses;

    test.expect(6);
    test.ok(results.errors.length === numberOfExpectedErrors, "Every variable type except string should throw error");
    test.ok(results.successes.length === numberOfExpectedSuccesses);
    test.ok(Object.keys(testTemplate.test.blocks).length === 1, "Should have created only one block");
    test.ok(Object.keys(testTemplate.test.vars).length === 1, "Should have created only one variable");
    test.ok(testTemplate.test.vars[testVariables.testString1] !== undefined, "variable should correspond to input");
    test.ok(testTemplate.test.blocks[testVariables.testString1] !== undefined, "block key should correspond to input");
    test.done();
}
// template.load() can also be called with two arguments, the string path to a file, and a string specifying the name
// of the block within the context of the template, independent of the filename.
function testTemplateLoad2(test) {
    const testTemplate = template.create(testFile);
    const results = tryAllVariableTypes2(testTemplate.load, testVariables);

    const numberOfExpectedSuccesses = 1; // Only a string as both parameters should be valid
    const numberOfExpectedErrors = results.total - numberOfExpectedSuccesses;

    test.expect(6);
    test.ok(results.errors.length === numberOfExpectedErrors, "Every variable type except string should throw error");
    test.ok(results.successes.length === numberOfExpectedSuccesses);
    test.ok(Object.keys(testTemplate.test.blocks).length === 1, "Should have created only one block");
    test.ok(Object.keys(testTemplate.test.vars).length === 1, "Should have created only one variable");
    test.ok(testTemplate.test.vars[testVariables.testString1] !== undefined, "variable should correspond to input");
    test.ok(testTemplate.test.blocks[testVariables.testString1] !== undefined, "block key should correspond to input");
    test.done();
}

function testTemplateSet1(test) {
    const testTemplate = template.create(testFile);
    const results = tryAllVariableTypes1(testTemplate.set, testVariables);

    const numberOfExpectedSuccesses = 1; // Only an object literal should be valid
    const numberOfExpectedErrors = results.total - numberOfExpectedSuccesses;

    test.expect(3);
    test.ok(results.errors.length === numberOfExpectedErrors, "Only an object literal should be valid");
    test.ok(results.successes.length === numberOfExpectedSuccesses);
    test.ok(Object.keys(testTemplate.test.vars).length === testObjectSize, "There are two values in testObject1");
    test.done();
}

function testTemplateSet2(test) {
    const testTemplate = template.create(testFile);
    const results = tryAllVariableTypes2(testTemplate.set, testVariables);


    const numberOfExpectedSuccesses = results.total / Object.keys(testVariables).length;
    const numberOfExpectedErrors = results.total - numberOfExpectedSuccesses;
    test.expect(3);
    test.strictEqual(results.errors.length, numberOfExpectedErrors,
        "Errors should be thrown if the second parameter is not a string");
    test.strictEqual(results.successes.length, numberOfExpectedSuccesses);
    test.strictEqual(Object.keys(testTemplate.test.vars).length, 1, 'only one valid variable should have been created');
    test.done();
}




function testPageRender(test) {

    const testTemplate = template.create(testFile);

    testTemplate.set(undefined, "templateTestUndefined1");
    testTemplate.set(testVariables.testString1, "templateTestString1");
    testTemplate.set(testVariables.testNumber1, "templateTestNumber1");
    testTemplate.set(testVariables.testArray1, "templateTestArray1");
    testTemplate.set(testVariables.testObject1, "templateTestObject1");
    testTemplate.set(testVariables.testPromise1, "templateTestPromise1");
    testTemplate.set(testVariables.testReadableStream1, "templateTestReadableStream1");
    testTemplate.set(testVariables.testDuplexStream1, "templateTestDuplexStream1");
    testTemplate.set(testVariables.testTransformStream1, "templateTestTransformStream1");
    testTemplate.set(testVariables.testFunction1, "templateTestFunction1");
    const templateVarsObject = Object.keys(testTemplate.test.vars);

    /**
    * showUndefinedBlock() function testing
    */
    const showUndefinedBlockErrors = [];
    const tryShowWithType = function (arg1, arg2) {
        try {
            testTemplate.showUndefinedBlock(arg1, arg2);
        } catch (ignore) {
            showUndefinedBlockErrors.push([typeof arg1, arg2]);
        }
    };
    // Attempt to use with all variable types
    tryShowWithType();
    tryShowWithType(undefined);
    tryShowWithType(null);
    tryShowWithType(testNumber1);
    tryShowWithType(testArray1);
    tryShowWithType(testPromise1);
    tryShowWithType(testReadableStream1);
    tryShowWithType(testDuplexStream1);
    tryShowWithType(testTransformStream1);
    tryShowWithType(testFunction1);
    tryShowWithType(testObject1);
    tryShowWithType(testString1); // The only one that should work
    tryShowWithType(testString1, false);
    const templateShowTagsObject = Object.keys(testTemplate.test.showTags);

    /**
    * remove() function testing
    */
    const removeErrors = [];
    const tryRemoveWithType = function (arg1) {
        try {
            testTemplate.remove(arg1);
        } catch (ignore) {
            removeErrors.push(typeof arg1);
        }
    };
    tryRemoveWithType();
    tryRemoveWithType(undefined);
    tryRemoveWithType(null);
    tryRemoveWithType(testNumber1);
    tryRemoveWithType(testArray1);
    tryRemoveWithType(testPromise1);
    tryRemoveWithType(testReadableStream1);
    tryRemoveWithType(testDuplexStream1);
    tryRemoveWithType(testTransformStream1);
    tryRemoveWithType(testFunction1);
    tryRemoveWithType(testObject1);
    tryRemoveWithType(testString1); // The only one that should work
    const templateHideObject1 = Object.keys(testTemplate.test.hide);
    const templateHidenBlock1 = testTemplate.test.hide[templateHideObject1[0]];

    /**
    * retstore() function testing
    */
    const restoreErrors = [];
    const tryRestoreWithType = function (arg1) {
        try {
            testTemplate.restore(arg1);
        } catch (ignore) {
            restoreErrors.push(typeof arg1);
        }
    };
    tryRestoreWithType();
    tryRestoreWithType(undefined);
    tryRestoreWithType(null);
    tryRestoreWithType(testNumber1);
    tryRestoreWithType(testArray1);
    tryRestoreWithType(testPromise1);
    tryRestoreWithType(testReadableStream1);
    tryRestoreWithType(testDuplexStream1);
    tryRestoreWithType(testTransformStream1);
    tryRestoreWithType(testFunction1);
    tryRestoreWithType(testObject1);
    tryRestoreWithType(testString1); // The only one that should work
    const templateHideObject2 = Object.keys(testTemplate.test.hide);
    const templateHidenBlock2 = testTemplate.test.hide[templateHideObject2[0]];

    // Visible template test values and setup

    testTemplate.showUndefinedBlock("escapedBlock");

    let testHtml1 = `<marquee behavior="scroll" direction="left" `;            // Broken into multiple statements
    testHtml1 += `style="color:#F00;background-color:#00F;font-size:30px;">`; // because JSLint doesn't like ES6
    testHtml1 += `This is some HTML</marquee>`;                              // multi-line template strings

    testTemplate.set(testHtml1, "templateTestHtml1");
    testTemplate.remove("removedBlock");
    const contactList = [
        {
            name: 'Bruce',
            age: 45,
            email: 'bruce@talismanTemplate.com'
        },
        {
            name: 'Jane',
            age: 31,
            email: 'jane@talismanTemplate.com'
        },
        {
            name: 'Steve',
            age: 22,
            email: 'steve@talismanTemplate.com'
        }
    ];
    testTemplate.set(contactList[0], 'profileBlock');
    testTemplate.set(contactList, 'contactsBlock');

    const deeplink1 = {
        level1: {
            level2: {
                level3: "boop"
            }
        }
    };
    testTemplate.set(deeplink1, 'deeplinkTest');

    if (test !== undefined) {
        // Begin testing
        let htmlResult = '';
        testTemplate.render()
            .on('data', function (chunk) {
                htmlResult += chunk.toString();
            })
            .on('end', function () {
                const $ = dom.load(htmlResult);

                // Expect as many tests as there are elements with the class 'test'
                const renderTests = $('.test').get().length;
                const otherTests = 8;
                test.expect(renderTests + otherTests);

                test.ok(setErrors.length === 11, "Bad set() functions should throw an error");
                test.ok(templateVarsObject.length === 12, 'There should be 12 items in the variables array');
                test.ok(showUndefinedBlockErrors.length === 11, "Bad showUndefinedBlock() should throw an error");
                test.ok(templateShowTagsObject.length === 1, "There should be one key in the template showTags object");
                test.ok(removeErrors.length === 11, "Bad remove() should throw an error");
                test.ok(templateHideObject1.length === 1, "There should be one key in the template showTags object");
                test.ok(templateHidenBlock1 === true, "Hidden block should be true");
                test.ok(restoreErrors.length === 11, "Bad restore() should throw an error");
                test.ok(templateHideObject2.length === 1, "There should be one key in the template showTags object");
                test.ok(templateHidenBlock2 === false, "Hidden block should be false");

                // Rendering tests.
                test.ok($('#testVars1').text().trim() === testString1, "Renders a string");
                test.ok($('#testVars2').text().trim() === testNumber1.toString(), "Renders a number");
                test.ok($('#testVars3').text().trim() === JSON.stringify(testArray1), "Renders an array");
                test.ok($('#testVars4').text().trim() === JSON.stringify(testObject1), "Renders an object");
                test.ok($('#testVars5').text().trim() === testPromise1Text, "Renders a promise");
                test.ok($('#testVars6').text().trim() === readableMessage, "Renders a readable stream");
                test.ok($('#testVars7').text().trim() === duplexMessage, "Renders a duplex stream");
                test.ok($('#testVars8').text().trim() === transformMessage, "Renders a transform stream");
                test.ok($('#testVars9').text().trim() === testFunction1(), "Renders a value returned from a function");
                test.ok($('#testVars10').text().trim() === "", "Renders nothing");

                test.ok($('#testTags1').text().trim() === "{templateTestUndefined1}", "Renders the tag itself");
                test.ok($('#testTags2').text().trim() === "", "Renders nothing");
                test.ok($('#testTags3').html().trim() === testHtml1, "Renders unfiltered HTML");
                test.ok($('#testTags4').html().trim() === escapeHtml(testHtml1), "render escaped html");

                test.ok(
                    $('#testBlocks1').text().trim() === "This is a static block with no variables associated with it.",
                    "Static blocks render correctly"
                );
                test.ok($('#testBlocks2').text().trim() === "", "Renders nothing");
                test.ok($('#profileEmail').text().trim() === contactList[0].email, "Static blocks render correctly");
                test.ok($('#testBlocks4').find('.iteratedRow').length === contactList.length, "iterable blocks work");
                test.ok($('#testBlocks5').text().trim() === contactList[1].email, "Renders the email address");
                test.ok(
                    $('#testBlocks6').text().trim() === deeplink1.level1.level2.level3,
                    "Renders the deeplinked variable"
                );

                test.done();
            });
    } else {
        // If this function is not being used by the test suite, then return the template
        // so that it can be rendered.
        return testTemplate;
    }
}
module.exports = {
    contentParsingTest,
    templateInterfaceTest,
    testCreateInvalidTemplate,
    testCreateValidTemplate,
    testTemplateLoad1,
    testTemplateLoad2,
    testTemplateSet1,
    testTemplateSet2
    //testPageRender
};

import {
  firstOf,
  Integer,
  Literal,
  microgrammar,
  RestOfLine, zeroOrMore,
} from '@atomist/microgrammar';
import test from 'ava'

test('should match literal text within a string', (t) => {
  // given
  const mg = microgrammar<{
    name: string // Defines the term and the type
  }>({
    name: 'Miguel', // Defines the term itself, in this case a literal text
  })
  const input = `
  Hi, my name is Miguel
  `;

  // when
  const match = mg.firstMatch(input);

  // then
  if (!match) { // Match right now is the Union type of ( (PatternMatch & {name: string}) | null )
    t.fail('No match found.');
    return
  }

  // match type is the Intersection Type of PatternMatch & the Terms type
  t.is(match.name, 'Miguel')

});

test('should match a regex as a term', (t) => {
  // given
  const mg = microgrammar<{
    imageVersion: string
  }>({
    imageVersion: /\d+.\d+.\d+/, // Terms can be RegExes
  });
  const input = `
  FROM nginx:1.23.0 as BUILD
  ...
  PORT 3000
  `;

  // when
  const match = mg.firstMatch(input);

  // then
  if (!match) {
    t.fail('No match found.');
    return
  }

  t.is(match.imageVersion, '1.23.0')

});

test('should match terms using composition', (t) => {
  // given
  const mg = microgrammar<{
    mayor: string
    minor: string
    patch: string
  }>({
    mayor: /\d+/,
    _mayorSeparator: '.', // Excluded terms start with an underscore
    minor: /\d+/,
    _minorSeparator: '.', // Terms should not repeat, the reason for naming excluded terms
    patch: /\d+/,
  });
  const input = `
  FROM nginx:1.23.0 as BUILD
  ...
  PORT 3000
  `;

  // when
  const match = mg.firstMatch(input);

  // then
  if (!match) {
    t.fail('No match found.');
    return
  }

  t.is(match.mayor, '1')
  t.is(match.minor, '23')
  t.is(match.patch, '0')
});

test('should match terms using composition and matchers', (t) => {
  // given
  const dot = new Literal('.'); // Reusable matcher
  const mg = microgrammar<{
    mayor: number
    minor: number
    patch: number
  }>({
    mayor: Integer, // Provided matcher for Integers
    _mayorSeparator: dot, // Use the matcher previously defined multiple times
    minor: Integer,
    _minorSeparator: dot,
    patch: Integer,
  });
  const input = `
  FROM nginx:1.23.0 as BUILD
  ...
  PORT 3000
  `;

  // when
  const match = mg.firstMatch(input);

  // then
  if (!match) {
    t.fail('No match found.');
    return
  }

  // Note that the matcher also gives type conversion, these were strings before
  t.is(match.mayor, 1)
  t.is(match.minor, 23)
  t.is(match.patch, 0)
});

test('should match terms using composition and matchers and other microgrammars', (t) => {
  // given
  const dot = new Literal('.');
  const semanticVersionImageTag = microgrammar<{
    mayor: number
    minor: number
    patch: number
  }>({
    mayor: Integer,
    _mayorSeparator: dot,
    minor: Integer,
    _minorSeparator: dot,
    patch: Integer,
  });
  const mg = microgrammar<{
    imageName: string
    imageVersion: string | { mayor: number; minor: number; patch: number }
  }>({
    imageName: /[a-zA-Z\d]+/,
    semicolon: ':',
    // Composition of many terms based on microgrammars, regexes or literals
    imageVersion: firstOf(semanticVersionImageTag, /[a-zA-Z][a-zA-Z\d]+/, 'latest'),
  });
  const input = `
  FROM nginx:1.23.0 as BUILD
  ...
  PORT 3000
  FROM node:latest as TARGET
  `;

  // when
  const matches = mg.findMatches(input);

  // then
  if (!matches.length) {
    t.fail('No matches found.');
    return
  }
  
  const nginx = matches[0];

  if(!nginx) {
    t.fail('nginx image not found')
    return
  }

  const nginxImageVersion = nginx.imageVersion as { mayor: number; minor: number; patch: number };
  t.is(nginxImageVersion.mayor, 1)
  t.is(nginxImageVersion.minor, 23)
  t.is(nginxImageVersion.patch, 0)
  
  const node = matches[1];
  
  if (!node) {
    t.fail('node image not found')
    return
  }
  
  const nodeImageVersion = node.imageVersion as string;
  
  t.is(nodeImageVersion, 'latest');
});

test('should match with terms having multiple instances', (t) => {
  // given
  const nameAndValue =microgrammar<{
    name: string
    value: string
  }>({
    name: /[A-Za-z]/,
    _colon: ':',
    value: RestOfLine, // Matches everything until a EOL
  });

  const mg = microgrammar<{
    entries: { name: string; value: string }[]
  }>({
    entries: zeroOrMore(nameAndValue),
  });

  // when
  const match = mg.firstMatch(`
  a: ten
  b: twenty
  c: thirty
  `);

  // then
  if(!match) {
    t.fail('No match found');
    return;
  }

  // Type safety of inlined microgrammars
  t.deepEqual(match.entries, [
    {
      name: 'a',
      value: 'ten',
    },
    {
      name: 'b',
      value: 'twenty',
    },
    {
      name: 'c',
      value: 'thirty',
    },
  ])
});

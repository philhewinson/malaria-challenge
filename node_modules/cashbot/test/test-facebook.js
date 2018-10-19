'use strict';

var expect = require('chai').expect;
var facebook = require('../lib/facebook');

var recs = [
  {
    title: 'Title 1',
    image: 'Image 1',
    url: 'URL 1',
    description: 'Description 1'
  },
  {
    title: 'Title 2',
    image: 'Image 2',
    url: 'URL 2',
    description: 'Description 2'
  }
];

describe('#facebook/methods', function() {

  it('defaults', function() {
    var result = [];
    result.push(facebook.carousel());
    result.push(facebook.card());
    result.push(facebook.list());

    var compare = [];
    compare.push({ attachment: { type: 'template', payload: { template_type: 'generic', elements: [] } } });
    compare.push({ attachment: { type: 'template', payload: { template_type: 'generic', elements: [] } } });
    compare.push({ attachment: { type: 'template', payload: { template_type: 'list', elements: [] } } });
    expect(result).to.deep.equal(compare);
  });

  it('single card carousel', function() {
    var result = facebook.carousel([recs[0]]);
    var compare = { attachment: {
      type: 'template',
      payload: {
        template_type: 'generic',
        elements: [
          {
            title: 'Title 1',
            image_url: 'Image 1',
            subtitle: 'Description 1',
            default_action: { type: 'web_url', url: 'URL 1' },
            buttons: [ { type: 'web_url', url: 'URL 1', title: 'Check It Out' } ]
          }
        ]
      }
    }};
    expect(result).to.deep.equal(compare);
  });

  it('single card carousel label', function() {
    var result = facebook.carousel([recs[0]], 'BEN');
    var compare = { attachment: {
      type: 'template',
      payload: {
        template_type: 'generic',
        elements: [
          {
            title: 'Title 1',
            image_url: 'Image 1',
            subtitle: 'Description 1',
            default_action: { type: 'web_url', url: 'URL 1' },
            buttons: [ { type: 'web_url', url: 'URL 1', title: 'BEN' } ]
          }
        ]
      }
    }};
    expect(result).to.deep.equal(compare);
  });

  it('full carousel', function() {
    var result = facebook.carousel(recs);
    var compare = { attachment: {
      type: 'template',
      payload: {
        template_type: 'generic',
        elements: [
          {
            title: 'Title 1',
            image_url: 'Image 1',
            subtitle: 'Description 1',
            default_action: { type: 'web_url', url: 'URL 1' },
            buttons: [ { type: 'web_url', url: 'URL 1', title: 'Check It Out' } ]
          },
          {
            title: 'Title 2',
            image_url: 'Image 2',
            subtitle: 'Description 2',
            default_action: { type: 'web_url', url: 'URL 2' },
            buttons: [ { type: 'web_url', url: 'URL 2', title: 'Check It Out' } ]
          }
        ]
      }
    }};
    expect(result).to.deep.equal(compare);
  });

  it('single card', function() {
    var result = facebook.card([recs[0]]);
    var compare = { attachment: {
      type: 'template',
      payload: {
        template_type: 'generic',
        elements: [
          {
            title: 'Title 1',
            image_url: 'Image 1',
            subtitle: 'Description 1',
            default_action: { type: 'web_url', url: 'URL 1' },
            buttons: [ { type: 'web_url', url: 'URL 1', title: 'Check It Out' } ]
          }
        ]
      }
    }};
    expect(result).to.deep.equal(compare);
  });

  it('single card label', function() {
    var result = facebook.card([recs[0]], 'BEN');
    var compare = { attachment: {
      type: 'template',
      payload: {
        template_type: 'generic',
        elements: [
          {
            title: 'Title 1',
            image_url: 'Image 1',
            subtitle: 'Description 1',
            default_action: { type: 'web_url', url: 'URL 1' },
            buttons: [ { type: 'web_url', url: 'URL 1', title: 'BEN' } ]
          }
        ]
      }
    }};
    expect(result).to.deep.equal(compare);
  });

  it('full card', function() {
    var result = facebook.card(recs);
    var compare = { attachment: {
      type: 'template',
      payload: {
        template_type: 'generic',
        elements: [
          {
            title: 'Title 1',
            image_url: 'Image 1',
            subtitle: 'Description 1',
            default_action: { type: 'web_url', url: 'URL 1' },
            buttons: [ { type: 'web_url', url: 'URL 1', title: 'Check It Out' } ]
          }
        ]
      }
    }};
    expect(result).to.deep.equal(compare);
  });

  it('single card list', function() {
    var result = facebook.list([recs[0]]);
    var compare = { attachment: {
      type: 'template',
      payload: {
        template_type: 'list',
        elements: [
          {
            title: 'Title 1',
            image_url: 'Image 1',
            subtitle: 'Description 1',
            default_action: { type: 'web_url', url: 'URL 1' },
            buttons: [ { type: 'web_url', url: 'URL 1', title: 'Check It Out' } ]
          }
        ]
      }
    }};
    expect(result).to.deep.equal(compare);
  });

  it('single card list label', function() {
    var result = facebook.list([recs[0]], 'BEN');
    var compare = { attachment: {
      type: 'template',
      payload: {
        template_type: 'list',
        elements: [
          {
            title: 'Title 1',
            image_url: 'Image 1',
            subtitle: 'Description 1',
            default_action: { type: 'web_url', url: 'URL 1' },
            buttons: [ { type: 'web_url', url: 'URL 1', title: 'BEN' } ]
          }
        ]
      }
    }};
    expect(result).to.deep.equal(compare);
  });

  it('full list', function() {
    var result = facebook.list(recs);
    var compare = { attachment: {
      type: 'template',
      payload: {
        template_type: 'list',
        elements: [
          {
            title: 'Title 1',
            image_url: 'Image 1',
            subtitle: 'Description 1',
            default_action: { type: 'web_url', url: 'URL 1' },
            buttons: [ { type: 'web_url', url: 'URL 1', title: 'Check It Out' } ]
          },
          {
            title: 'Title 2',
            image_url: 'Image 2',
            subtitle: 'Description 2',
            default_action: { type: 'web_url', url: 'URL 2' },
            buttons: [ { type: 'web_url', url: 'URL 2', title: 'Check It Out' } ]
          }
        ]
      }
    }};
    expect(result).to.deep.equal(compare);
  });

});

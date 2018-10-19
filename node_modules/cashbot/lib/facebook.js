var message = function(type) {
  return {
    attachment: {
      type: 'template',
      payload: {
        template_type: type
      }
    }
  };
};

var txt = function(t) {
  return {
    text: t
  };
};

var card = function(data, label) {
  return {
    title: data.title,
    image_url: data.image,
    subtitle: data.description,
    default_action: {
      type: 'web_url',
      url: data.url
    },
    buttons: [
      {
        type: "web_url",
        url: data.url,
        title: label || 'Check It Out'
      }
    ]
  };
};

var elements = function(data, label, isList) {
  var ele = [];
  for (var i in data) {
    ele.push(card(data[i], label));
    if (isList && i >= 3) {
      return ele;
    }
  }
  return ele;
};

module.exports = {
  carousel: function(recommendations, label) {
    var msg = message('generic');
    msg.attachment.payload.elements = elements(recommendations, label);
    return msg;
  },
  card: function(recommendations, label) {
    var msg = message('generic');
    msg.attachment.payload.elements = [];
    if (recommendations && recommendations.length) {
      msg.attachment.payload.elements = elements([recommendations[0]], label);
    }
    return msg;
  },
  list: function(recommendations, label) {
    var msg = message('list');
    msg.attachment.payload.elements = [];
    if (recommendations && recommendations.length) {
      msg.attachment.payload.elements = elements(recommendations, label, true);
    }
    return msg;
  },
  text: function(t) {
    return txt(t);
  }
}

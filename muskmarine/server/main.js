import { Meteor } from 'meteor/meteor';

function cleanUpGamesAndPlayers() {
  var cutOff = moment().subtract(2, 'hours').toDate().getTime();

  var numGamesRemoved = Games.remove({
    createdAt: {$lt: cutOff}
  });

  var numPlayersRemoved = Players.remove({
    createdAt: {$lt: cutOff}
  });
}

function getRandomLocation(){
  var locationIndex = Math.floor(Math.random() * locations.length);
  return locations[locationIndex];
}

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

function assignRoles(players, location){
  var default_role = location.roles[location.roles.length - 1];
  var roles = location.roles.slice();
  var shuffled_roles = shuffleArray(roles);
  var role = null;

  players.forEach(function(player){
    if (!player.isSpy){
      role = shuffled_roles.pop();

      if (role === undefined){
        role = default_role;
      }

      Players.update(player._id, {$set: {role: role}});
    }
  });
}

Meteor.startup(function () {
  // Delete all games and players at startup
  Games.remove({});
  Players.remove({});
});

var MyCron = new Cron(60000);

MyCron.addJob(5, cleanUpGamesAndPlayers);

Meteor.publish('games', function(accessCode) {
  return Games.find({"accessCode": accessCode});
});

Meteor.publish('players', function(gameID) {
  return Players.find({"gameID": gameID});
});

Games.find({"state": 'choosingCrisisSource'}).observeChanges({
  added: function (id, game) {
    var players = Players.find({"gameID": id});

    var chooserIndex = Math.floor(Math.random() * players.count());

    players.forEach(function(player, index){
      Players.update(player._id, {$set: {
        isChoosingCrisis: index === chooserIndex
      }});
    });

    Games.update(id, {$set: {state: 'choosingCrisis'}});
  }
});

Games.find({"state": 'findingElon'}).observeChanges({
  added: function (id, game) {
    var players = Players.find({gameID: id}).fetch();

    var nonChoosers = players.filter(player => !player.isChoosingCrisis);
    var elonIndex = Math.floor(Math.random() * nonChoosers.length);
    var elonId = nonChoosers[elonIndex]._id;

    players.forEach(function(player, index){
      Players.update(player._id, {$set: {
        isElon: player._id === elonId,
        submittedSolution: false
      }});
    });

    Games.update(id, {$set: {state: 'solvingCrisis'}});
  }
});

Players.find({"submittedSolution": true}).observeChanges({
    added: function (id, player) {
    var game = Games.findOne(player.gameID);
    var players = Players.find({gameID: game._id}).fetch();

    if (!players.every(player => player.submittedSolution)) {
      return;
    }

    var gameEndTime = moment().add(game.lengthInMinutes, 'minutes').valueOf();

    Games.update(game._id, {$set: {state: 'inProgress', endTime: gameEndTime, paused: false, pausedTime: null}});
  }
});

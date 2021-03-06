/* global $store, le */

const io = require('socket.io-client')
const { configure, autorun, observable, decorate } = require('mobx')
configure({
  isolateGlobalState: true
})

class User {
  constructor (nick, color) {
    this.nick = nick || 'anonymous'
    this.color = color || 'white'
  }
}

decorate(User, {
  nick: observable,
  color: observable
})

const wrap = require('./cliwrap')

const userToString = user => `<span style='color: ${user.color || 'white'}'>${user.nick || 'anonymous'}</span>`

const handleLine = (socket, user, ln, exit, cfg, log) => {
  if (ln.startsWith('/')) {
    switch (ln.split(' ')[0].substr(1).toLowerCase()) {
      case 'help':
        log(`Trollbox CLI help
/help: this help screen
/exit: leave trollbox CLI
/nick &lt;nickname&gt;: set your nickname
/color &lt;color&gt;: set your color
/img &lt;(on|off)&gt;: turn image display on or off`)
        break
      case 'exit':
        exit()
        break
      case 'nick':
        $store.set('.config/trollbox/nick', user.nick = ln.split(' ').slice(1).join(' '))
        break
      case 'color':
        $store.set('.config/trollbox/color', user.color = ln.split(' ').slice(1).join(' '))
        break
      case 'img':
        if (ln.split(' ')[1] === 'on') {
          cfg.img = true
          log('Show images: ON')
        } else {
          cfg.img = false
          log('Show images: OFF')
        }
        break
      default:
        socket.emit('message', ln)
        break
    }
  } else {
    socket.emit('message', ln)
  }
}

const isImgUrl = url => (/\.(gif|jpg|jpeg|tiff|png|webp)$/i).test(url.pathname)

const app = cli => {
  var cfg = { img: false }
  var exit
  var p = new Promise(resolve => { exit = resolve })
  cli.onexit = exit
  const socket = io(cli.arg.arguments[0] || '//www.windows93.net:8081')
  const currentUser = new User($store.get('.config/trollbox/nick'), $store.get('.config/trollbox/color'))
  cli.online = ln => { handleLine(socket, currentUser, ln, exit, cfg, cli.log) }
  socket.on('user joined', user => {
    cli.log(`${userToString(user)} has entered teh trollbox`)
  })
  socket.on('user left', user => {
    cli.log(`${userToString(user)} has left teh trollbox`)
  })
  socket.on('user change nick', (old, nyw) => {
    cli.log(`${userToString(old)} is now known as ${userToString(nyw)}`)
  })
  socket.on('message', msg => {
    if (!cfg.img) cli.log(`${userToString(msg)}: ${msg.msg}`)
    else {
      let logs = [`${userToString(msg)}: `]
      let logsCtr = 0
      msg.msg.split(' ').forEach(betweenSpace => {
        try {
          let url = new URL(betweenSpace)
          if (isImgUrl(url)) {
            logs.push(`<img src='${url}' style='max-width: 100%;'>`)
            logsCtr += 2
            logs[logsCtr] = ''
          } else logs[logsCtr] += betweenSpace + ' '
        } catch (ex) {
          logs[logsCtr] += betweenSpace + ' '
        }
      })
      logs.forEach(e => { cli.log(e) })
    }
  })
  autorun(() => { cli.prompt = `${userToString(currentUser)}&gt;&nbsp;` })
  autorun(() => { socket.emit('user joined', currentUser.nick, currentUser.color) })

  return p.then(() => { socket.close() })
}

le._apps.trollboxcli = {
  terminal: true,
  exec: function () { wrap.call(this, app) }
}

import React from 'react'
import i18n from 'i18n'
import { ipcRenderer, remote } from 'electron'
import { AutoSizer } from 'react-virtualized'
import { Paper, Menu } from 'material-ui'
import DeleteSvg from 'material-ui/svg-icons/action/delete'
import PlaySvg from 'material-ui/svg-icons/av/play-arrow'
import PauseSvg from 'material-ui/svg-icons/av/pause'

import RunningTask from './RunningTask'
import FinishedTask from './FinishedTask'
import ErrorDialogInTrans from './ErrorDialogInTrans'
import FlatButton from '../common/FlatButton'
import DialogOverlay from '../common/DialogOverlay'
import PureDialog from '../common/PureDialog'
import ScrollBar from '../common/ScrollBar'
import { LIButton } from '../common/Buttons'
import MenuItem from '../common/MenuItem'

class TrsContainer extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      x: 0,
      y: 0,
      ctrl: false,
      shift: false,
      play: true,
      pause: true,
      menuShow: false,
      tasks: [],
      userTasks: [],
      finishTasks: [],
      clearRunningDialog: false,
      clearFinishedDialog: false,
      finished: false,
      errors: null
    }

    this.taskRefs = {}
    this.taskSelected = []
    this.finishSelected = []

    this.toggleDialog = op => this.setState({ [op]: !this.state[op] })

    this.keydown = (event) => {
      if (event.ctrlKey === this.state.ctrl && event.shiftKey === this.state.shift) return
      this.setState({
        ctrl: event.ctrlKey,
        shift: event.shiftKey
      })
    }

    this.keyup = (event) => {
      if (event.ctrlKey === this.state.ctrl && event.shiftKey === this.state.shift) return
      this.setState({
        ctrl: event.ctrlKey,
        shift: event.shiftKey
      })
    }

    this.hideMenu = () => {
      this.setState({
        menuShow: false
      })
    }

    this.openMenu = (event, obj) => {
      console.log('this.openMenu', event, obj)
      const containerDom = document.getElementById('content-container')
      const maxLeft = containerDom.offsetLeft + containerDom.clientWidth - 168
      const x = event.clientX > maxLeft ? maxLeft : event.clientX
      const maxTop = containerDom.offsetTop + containerDom.offsetHeight - (16 + 96 + (obj.play + obj.pause) * 48)
      const y = event.clientY > maxTop ? maxTop : event.clientY
      this.setState({ menuShow: true, x, y, play: obj.play, pause: obj.pause, tasks: obj.tasks })
    }

    this.select = (type, id, isSelected, index, e) => {
      let selectedArray
      /*
        selectedArray is a reference of this.taskSelected or this.finishSelected
        posh/pop selectedArray would alse change vlaue of this.taskSelected or this.finishSelected
      */
      if (type === 'running') {
        selectedArray = this.taskSelected
        this.cleanFinishSelect()
      } else {
        selectedArray = this.finishSelected
        this.cleanTaskSelect()
      }

      /* ctrl */
      if (this.state.ctrl) {
        /* only left click */
        if (e.button === 0) {
          if (isSelected) {
            /* cancel select */
            selectedArray.splice(selectedArray.indexOf(id), 1)
            this.taskRefs[id].updateDom(!isSelected)
          } else {
            /* add select */
            selectedArray.push(id)
            this.taskRefs[id].updateDom(!isSelected)
          }
        }
      } else if (this.state.shift && e.button === 0) {
        /* shift */
        if (selectedArray.length === 0) {
          selectedArray.push(id)
          this.taskRefs[id].updateDom(true)
        } else {
          const userTasks = this.state.userTasks
          const finishTasks = this.state.finishTasks
          const lastSelect = selectedArray[selectedArray.length - 1]
          let lastIndex
          let currentIndex
          if (type === 'running') {
            lastIndex = userTasks.findIndex(task => task.uuid === lastSelect)
            currentIndex = userTasks.findIndex(task => task.uuid === id)
          } else {
            lastIndex = finishTasks.findIndex(task => task.uuid === lastSelect)
            currentIndex = finishTasks.findIndex(task => task.uuid === id)
          }
          let minor = lastIndex
          let major = currentIndex
          if (lastIndex > currentIndex) {
            minor = currentIndex
            major = lastIndex
          }
          if (type === 'running') this.cleanTaskSelect()
          else this.cleanFinishSelect()
          for (let i = minor; i <= major; i++) {
            let uuid
            if (type === 'running') {
              uuid = userTasks[i].uuid
            } else {
              uuid = finishTasks[i].uuid
            }
            selectedArray.push(uuid)
            this.taskRefs[uuid].updateDom(true)
          }
        }
      } else if (!(e.button === 2 && isSelected)) {
        /* select an item: no shift or ctrl, not right click a selected item */
        if (type === 'running') this.cleanTaskSelect()
        else this.cleanFinishSelect()
        selectedArray.push(id)
        this.taskRefs[id].updateDom(true)
        this.setState({ tasks: [this.taskRefs[id].props.task] })
      }

      /* right click: open menu */
      if (e.button === 2) {
        const tasks = []
        let play = false
        let pause = false

        /* get selected tasks */
        selectedArray.forEach((item) => {
          if (this.taskRefs[item]) tasks.push(this.taskRefs[item].props.task)
        })

        /* add play or pause option to running task */
        if (type === 'running') {
          for (let i = 0; i < tasks.length; i++) {
            if (tasks[i].paused) play = true
            else pause = true
          }
        }

        this.openMenu(e, { type, pause, play, tasks })
      }
    }

    this.cleanTaskSelect = () => {
      this.taskSelected.forEach((item) => {
        if (this.taskRefs[item]) {
          this.taskRefs[item].updateDom(false)
        }
      })
      this.taskSelected.length = 0 // need to keep the same reference
    }

    this.cleanFinishSelect = () => {
      this.finishSelected.forEach((item) => {
        if (this.taskRefs[item]) {
          this.taskRefs[item].updateDom(false)
        }
      })
      this.finishSelected.length = 0 // need to keep the same reference
    }

    /* ipc communication */
    this.pause = (uuid) => {
      ipcRenderer.send('PAUSE_TASK', [uuid])
    }

    this.resume = (uuid) => {
      ipcRenderer.send('RESUME_TASK', [uuid])
    }

    this.ignore = (uuid) => {
      ipcRenderer.send('FINISH_TASK', [uuid])
    }

    /* type: 'PAUSE', 'RESUME', 'DELETE' */
    this.handleAll = (tasks, type) => {
      ipcRenderer.send(`${type}_TASK`, tasks.map(t => t.uuid))
    }

    this.open = () => {
      if (Array.isArray(this.state.tasks) && this.state.tasks[0] && this.state.tasks[0].downloadPath) {
        const entryPath = remote.require('path').join(this.state.tasks[0].downloadPath, this.state.tasks[0].name)
        ipcRenderer.send('OPEN_TRANSMISSION', entryPath)
      }
    }

    this.openInDrive = () => {
      const { driveUUID, dirUUID } = this.state.tasks[0]
      this.props.navToDrive(driveUUID, dirUUID)
    }

    this.openErrorDialog = (errors, finished) => {
      this.setState({ errors, finished })
    }

    this.updateTransmission = (e, userTasks, finishTasks) => {
      // console.log('this.updateTransmission', userTasks, finishTasks)
      this.setState({ userTasks, finishTasks })
    }
  }

  componentDidMount () {
    document.addEventListener('keydown', this.keydown)
    document.addEventListener('keyup', this.keyup)
    ipcRenderer.on('UPDATE_TRANSMISSION', this.updateTransmission)
  }

  componentWillUnmount () {
    document.removeEventListener('keydown', this.keydown)
    document.removeEventListener('keyup', this.keyup)
    ipcRenderer.removeListener('UPDATE_TRANSMISSION', this.updateTransmission)
  }

  render () {
    const userTasks = this.state.userTasks
    const finishTasks = this.state.finishTasks

    const titileStyle = {
      display: 'flex',
      alignItems: 'center',
      padding: '8px 16px 8px 48px',
      height: 40,
      fontWeight: 500,
      fontSize: 12,
      color: 'rgba(0,0,0,0.38)'
    }

    /* show resumeAll button when allPaused = true */
    let allPaused = true
    userTasks.forEach((task) => {
      if (!task.paused) {
        allPaused = false
      }
    })

    const list = []

    /* running task title */
    const runningTaskTitle = () => (
      <div>
        <div style={titileStyle} >
          <div style={{ flexGrow: 1 }}>
            { i18n.__('Running Task Title %s', userTasks.length) }
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {
              allPaused
                ? <LIButton
                  tooltip={i18n.__('Resume All')}
                  disabled={!userTasks.length}
                  onClick={() => this.handleAll(userTasks, 'RESUME')}
                >
                  <PlaySvg />
                </LIButton>
                : <LIButton
                  tooltip={i18n.__('Pause All')}
                  disabled={!userTasks.length}
                  onClick={() => this.handleAll(userTasks, 'PAUSE')}
                >
                  <PauseSvg />
                </LIButton>
            }
            <LIButton
              tooltip={i18n.__('Clear All')}
              disabled={!userTasks.length}
              onClick={() => this.toggleDialog('clearRunningDialog')}
            >
              <DeleteSvg />
            </LIButton>
          </div>
        </div>
      </div>
    )

    list.push(runningTaskTitle())

    /* running task list */
    list.push(...userTasks.map((task, index) => (
      <RunningTask
        pin={this.props.pin}
        ref={ref => (this.taskRefs[task.uuid] = ref)}
        key={task.uuid}
        trsType={task.trsType}
        index={index}
        task={task}
        pause={this.pause}
        resume={this.resume}
        select={this.select}
        delete={() => this.toggleDialog('deleteRunningDialog')}
        openErrorDialog={this.openErrorDialog}
      />
    )))

    /* finished task title */
    const finishedTaskTitle = () => (
      <div>
        <div style={titileStyle}>
          <div style={{ flexGrow: 1 }}>
            { i18n.__('Finished Task Title %s', finishTasks.length) }
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <FlatButton
              label={i18n.__('Clear All Record')}
              labelStyle={{ fontSize: 12 }}
              disabled={!finishTasks.length}
              onClick={() => this.toggleDialog('clearFinishedDialog')}
            />
          </div>
        </div>
      </div>
    )

    list.push(finishedTaskTitle())

    /* finished task list */
    list.push(...finishTasks.map((task, index) => (
      <FinishedTask
        ref={ref => (this.taskRefs[task.uuid] = ref)}
        pin={this.props.pin}
        key={task.uuid}
        index={index}
        task={task}
        select={this.select}
        open={this.open}
        openInDrive={this.openInDrive}
        openErrorDialog={this.openErrorDialog}
      />
    )))

    list.push(<div style={{ height: 56 }} />)

    /* rowCount */
    const rowCount = userTasks.length + finishTasks.length + 3

    /* rowHeight */
    const rowHeight = 56

    /* rowRenderer */
    const rowRenderer = ({ key, index, style }) => (
      <div key={key} style={style}>
        { list[index] }
      </div>
    )
    return (
      <div style={{ height: '100%', width: '100%', backgroundColor: '#FFF', position: 'relative', overflow: 'hidden' }}>
        <div style={{ height: 73 }}>
          <div style={{ paddingLeft: 48, fontSize: 18, height: 64, display: 'flex', alignItems: 'center' }}>
            { i18n.__('Transfer') }
          </div>
        </div>
        <div style={{ height: 1, backgroundColor: '#e8eaed', width: '100%', marginLeft: 32 }} />
        <div style={{ height: 8 }} />
        <div style={{ height: 'calc(100% - 82px)', position: 'relative' }}>
          <AutoSizer>
            {({ height, width }) => (
              <ScrollBar
                allHeight={rowHeight * rowCount}
                height={height}
                width={width}
                rowHeight={rowHeight}
                rowRenderer={rowRenderer}
                rowCount={rowCount}
                overscanRowCount={3}
                style={{ outline: 'none' }}
              />
            )}
          </AutoSizer>
        </div>

        {/* menu */}
        {
          this.state.menuShow && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%'
              }}
              onClick={this.hideMenu}
            >
              <Paper style={{ position: 'absolute', top: this.state.y, left: this.state.x }}>
                <Menu>
                  {
                    this.state.play &&
                      <MenuItem
                        primaryText={this.state.tasks[0].state === 'failed' ? i18n.__('Retry') : i18n.__('Resume')}
                        onClick={() => this.handleAll(this.state.tasks, 'RESUME')}
                      />
                  }
                  {
                    this.state.pause &&
                      <MenuItem primaryText={i18n.__('Pause')} onClick={() => this.handleAll(this.state.tasks, 'PAUSE')} />
                  }
                  {
                    this.state.tasks.length === 1 && this.state.tasks[0].trsType === 'download' &&
                      <MenuItem primaryText={i18n.__('Open Downloads Folder')} onClick={this.open} />
                  }
                  {
                    this.state.tasks.length === 1 && this.state.tasks[0].trsType === 'upload' &&
                      <MenuItem primaryText={i18n.__('Show in Folder')} onClick={this.openInDrive} />
                  }
                  {
                    this.state.play &&
                      <MenuItem primaryText={i18n.__('Delete')} onClick={() => this.toggleDialog('deleteRunningDialog')} />
                  }
                  {
                    this.state.tasks[0].state === 'finished' &&
                      <MenuItem primaryText={i18n.__('Delete')} onClick={() => this.handleAll(this.state.tasks, 'DELETE')} />
                  }
                </Menu>
              </Paper>
            </div>
          )
        }
        {/* Delete Runing Tasks Dialog */}
        <DialogOverlay open={!!this.state.deleteRunningDialog}>
          <div>
            {
              this.state.deleteRunningDialog &&
                <div style={{ width: 320, padding: '24px 24px 0px 24px' }}>
                  <div style={{ fontSize: 20, fontWeight: 500, color: 'rgba(0,0,0,0.87)' }}>
                    { i18n.__('Delete Running Task Dialog Text 1') }
                  </div>
                  <div style={{ height: 20 }} />
                  <div style={{ color: 'rgba(0,0,0,0.54)' }}>
                    { i18n.__('Delete Running Task Dialog Text 2') }
                  </div>
                  <div style={{ height: 24 }} />
                  <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginRight: -24 }}>
                    <FlatButton
                      primary
                      label={i18n.__('Cancel')}
                      onClick={() => this.toggleDialog('deleteRunningDialog')}
                    />
                    <FlatButton
                      label={i18n.__('Confirm')}
                      primary
                      onClick={() => {
                        this.toggleDialog('deleteRunningDialog')
                        this.handleAll(this.state.tasks, 'DELETE')
                      }}
                    />
                  </div>
                </div>
            }
          </div>
        </DialogOverlay>

        {/* clear Running Tasks dialog */}
        <DialogOverlay open={!!this.state.clearRunningDialog}>
          <div>
            {
              this.state.clearRunningDialog &&
                <div style={{ width: 320, padding: '24px 24px 0px 24px' }}>
                  <div style={{ fontSize: 20, fontWeight: 500, color: 'rgba(0,0,0,0.87)' }}>
                    { i18n.__('Clear Running Task Dialog Text 1') }
                  </div>
                  <div style={{ height: 20 }} />
                  <div style={{ color: 'rgba(0,0,0,0.54)' }}>
                    { i18n.__('Clear Running Task Dialog Text 2') }
                  </div>
                  <div style={{ height: 24 }} />
                  <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginRight: -24 }}>
                    <FlatButton
                      primary
                      label={i18n.__('Cancel')}
                      onClick={() => this.toggleDialog('clearRunningDialog')}
                    />
                    <FlatButton
                      label={i18n.__('Delete')}
                      primary
                      onClick={() => {
                        this.toggleDialog('clearRunningDialog')
                        this.handleAll(userTasks, 'DELETE')
                      }}
                    />
                  </div>
                </div>
            }
          </div>
        </DialogOverlay>

        {/* clear Finished Tasks dialog */}
        <DialogOverlay open={!!this.state.clearFinishedDialog}>
          <div>
            {
              this.state.clearFinishedDialog &&
                <div style={{ width: 320, padding: '24px 24px 0px 24px' }}>
                  <div style={{ fontSize: 20, fontWeight: 500, color: 'rgba(0,0,0,0.87)' }}>
                    { i18n.__('Clear Finished Task Dialog Text 1') }
                  </div>
                  <div style={{ height: 20 }} />
                  <div style={{ color: 'rgba(0,0,0,0.54)' }}>
                    { i18n.__('Clear Finished Task Dialog Text 2') }
                  </div>
                  <div style={{ height: 24 }} />
                  <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginRight: -24 }}>
                    <FlatButton
                      label={i18n.__('Cancel')}
                      primary
                      onClick={() => this.toggleDialog('clearFinishedDialog')}
                    />
                    <FlatButton
                      label={i18n.__('Clear')}
                      primary
                      onClick={() => {
                        this.handleAll(this.state.finishTasks, 'DELETE')
                        this.toggleDialog('clearFinishedDialog')
                      }}
                    />
                  </div>
                </div>
            }
          </div>
        </DialogOverlay>

        {/* error dialog */}
        <PureDialog open={!!this.state.errors} onRequestClose={() => this.setState({ errors: null })} >
          {
            this.state.errors &&
              <ErrorDialogInTrans
                errors={this.state.errors}
                resume={this.resume}
                ignore={this.ignore}
                finished={this.state.finished}
                onRequestClose={() => this.setState({ errors: null })}
              />
          }
        </PureDialog>
      </div>
    )
  }
}

export default TrsContainer

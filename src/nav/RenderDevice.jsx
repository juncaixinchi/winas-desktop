import React from 'react'
import i18n from 'i18n'

import FlatButton from '../common/FlatButton'
import prettySize from '../common/prettySize'
import CircularLoading from '../common/CircularLoading'

class Disk extends React.PureComponent {
  constructor (props) {
    super(props)
    this.state = {}

    this.reqDataAsync = async () => {
      const { apis } = this.props
      const [space, stats] = await Promise.all([apis.requestAsync('space'), apis.requestAsync('stats')])
      return ({ space, stats })
    }
  }

  componentDidMount () {
    this.reqDataAsync().then(({ space, stats }) => this.setState({ space, stats })).catch(e => this.setState({ error: e }))
  }

  renderLoading () {
    return (
      <div style={{ width: '100%', height: 200 }} className="flexCenter" >
        <CircularLoading />
      </div>
    )
  }

  renderFailed (error) {
    const isUnauthorized = error && error.status === 401
    return (
      <div
        style={{
          height: 304,
          width: '100%',
          display: 'flex',
          alignItems: 'center'
        }}
        className="flexCenter"
      >
        {
          !isUnauthorized
            ? i18n.__('Error in Base Text')
            : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                flexDirection: 'column',
                height: 304,
                width: '100%'
              }}>
                <div style={{ flexGrow: 1 }} />
                <div style={{ height: 60, display: 'flex', alignItems: 'center' }}>
                  { `${i18n.__('Token Expired')},  ${i18n.__('Token Expired Text')}` }
                </div>
                <div style={{ flexGrow: 2 }} />

                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <FlatButton
                    primary
                    onClick={() => this.props.logout()}
                    label={i18n.__('Confirm')}
                  />
                </div>
              </div>
            )
        }
      </div>
    )
  }

  renderStorage () {
    const { space, stats, error } = this.state
    if (error) return this.renderFailed(error)
    if (!space || !stats) return this.renderLoading()

    const { audio, document, image, video } = stats
    const other = stats.others || { totalSize: 0 }
    if (!audio || !document || !image || !video) return (<div />)
    const { available, used } = space
    const usedPercent = used / (available + used)
    const dataSize = video.totalSize + image.totalSize + audio.totalSize + document.totalSize + other.totalSize
    const systemSize = Math.max(0, used * 1024 - dataSize)
    const countTotal = (dataSize + systemSize) / usedPercent

    const videoSize = video.totalSize / countTotal
    const imageSize = image.totalSize / countTotal
    const audioSize = audio.totalSize / countTotal
    const documentSize = document.totalSize / countTotal
    const otherSize = other.totalSize / countTotal
    const sysSize = systemSize / countTotal

    const data = [
      { color: '#2196f3', progress: videoSize, title: i18n.__('Video'), size: video.totalSize },
      { color: '#aa00ff', progress: imageSize, title: i18n.__('Picture'), size: image.totalSize },
      { color: '#f2497d', progress: audioSize, title: i18n.__('Music'), size: audio.totalSize },
      { color: '#ffb300', progress: documentSize, title: i18n.__('Document'), size: document.totalSize },
      { color: '#00c853', progress: otherSize, title: i18n.__('Others'), size: other.totalSize },
      { color: '#000000', progress: sysSize, title: i18n.__('System'), size: systemSize }
    ]
    console.log('renderStorage', stats, dataSize, systemSize, data, space)
    return (
      <div>
        <div
          style={{
            height: 16,
            width: 256,
            backgroundColor: '#eceff1',
            borderRadius: 4,
            overflow: 'hidden',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {
            data.map(v => !!v.progress && (
              <div
                style={{
                  backgroundColor: v.color,
                  width: Math.max(Math.ceil(v.progress * 200), 3),
                  height: 16,
                  marginRight: Math.min(Math.ceil(v.progress * 200), 3)
                }}
                key={v.color} />
            ))
          }
        </div>
        <div style={{ width: 256, margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          {
            data.map(({ color, title }) => (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 4, width: 100 }} key={title}>
                <div style={{ width: 8, height: 8, backgroundColor: color, marginTop: 2 }} />
                <div style={{ fontSize: 10, color: '#505259', marginLeft: 3, marginTop: 2 }}>
                  {title}
                </div>
              </div>
            ))
          }
        </div>
        <div style={{ width: '100%', height: 1, marginTop: 16, backgroundColor: '#e8eaed' }} />
        <div style={{ width: 256, height: 240, padding: '8px 24px' }} >
          {
            data.map(({ title, size }) => (
              <div style={{ height: 40, display: 'flex', alignItems: 'center', width: '100%' }} key={title}>
                <div style={{ fontWeight: 500, color: 'rgba(0,0,0,.76)' }}> {title}</div>
                <div style={{ flexGrow: 1 }} />
                <div style={{ fontWeight: 500, color: 'rgba(0,0,0,.29)' }}> {prettySize(size)} </div>
              </div>
            ))
          }
        </div>
      </div>
    )
  }

  render () {
    const name = this.props.selectedDevice.name || i18n.__('Default Product Name')
    const { isCloud } = this.props
    return (
      <div style={{ width: 300, height: 384, marginTop: -8, overflow: 'hidden' }}>
        <div style={{ height: 64, position: 'relative', paddingLeft: 24, paddingTop: 16 }}>
          <div style={{ height: 32, fontSize: 18, fontWeight: 500, color: 'rgba(0,0,0,.76)' }}>
            {name}
          </div>
          <div style={{ height: 22, fontSize: 12, color: 'rgba(14,5,10,.29)' }}>
            { isCloud ? i18n.__('Connected Via Cloud') : i18n.__('Connected Via LAN') }
          </div>
          <div style={{ position: 'absolute', top: 12, right: 8, height: 24 }}>
            <FlatButton
              primary
              label={i18n.__('Change Device')}
              onClick={this.props.onChangeDevice}
            />
          </div>
        </div>
        {this.renderStorage()}
      </div>
    )
  }
}

export default Disk

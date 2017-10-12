const m = require('mithril')
const stream = require('mithril/stream')
const sst = require('static-sum-type/configs/dev/foldThrow.js')
const yslashn = require('static-sum-type/modules/yslashn')


const encase = ({Y,N}) => f => (...xs) => {
    try {
        return Y(f(...xs))
    } catch(e){
        return N(e)
    }
}


const Model = (sideEffects, initialModel, actions$) => 
    stream.scan(function(p, n){

        sideEffects(actions$, p,n)

        if( n.type == 'UPDATE_FEED_VALUE' ){
            return {
                feedurl: n.value
                ,feedraw: null
                ,feedparsed: null
            }
        } else if ( n.type == 'FETCH_FEED' ){
            return p
        } else if ( n.type == 'PARSE_FEED' ){
            return p
        } else {
            return p
        }

        return p

    }, initialModel, actions$)

function DOMSideEffects(update, p, n){
    
    // eslint-disable-next-line fp/no-mutation, no-undef
    window.state = p

    if( n.type == 'FETCH_FEED' ){
        m.request({
            url: 'https://cors.now.sh/'+p.feedurl
            ,deserialize: i => i
            ,method: 'GET'
        })
            .then(function(response){
                
                // eslint-disable-next-line fp/no-mutation
                p.feedraw = response
                update({
                    type: 'PARSE_FEED'
                })
            })
    } else if (n.type == 'PARSE_FEED'){

        // eslint-disable-next-line no-undef
        const xml = new DOMParser().parseFromString(
            p.feedraw
                .replace(/itunes:/g, 'itunes_')
            , 'application/xml'
        )

        const defaultNode = { innerHTML: '', getAttribute: () => '' } 
        const xmlItems = Array.from(xml.querySelectorAll('item'))

        const xmlChannel = xml.querySelector('channel')
        
        const channel = {
            title: (xmlChannel.querySelector('title') || defaultNode).innerHTML
            ,link: (xmlChannel.querySelector('link') || defaultNode).innerHTML
            ,language: (xmlChannel.querySelector('language') || defaultNode).innerHTML
            ,copyright: (xmlChannel.querySelector('copyright') || defaultNode).innerHTML
            ,description: (xmlChannel.querySelector('description') || defaultNode).innerHTML
            ,itunesType: (xmlChannel.querySelector('itunes_type') || defaultNode).innerHTML
            ,itunesImageHref: (xmlChannel.querySelector('itunes_image') || defaultNode).getAttribute('href')
            ,items:
                xmlItems.map(function(xml){
                    return {
                        title: (xml.querySelector('title') || defaultNode).innerHTML
                        ,itunesSubtitle: (xml.querySelector('itunes_subtitle') || defaultNode).innerHTML
                        ,description: (xml.querySelector('description') || defaultNode).innerHTML
                        ,pubDate: (xml.querySelector('pubDate') || defaultNode).innerHTML
                        ,itunesAuthor: (xml.querySelector('itunes_author') || defaultNode).innerHTML
                        ,itunesTitle: (xml.querySelector('itunes_title') || defaultNode).innerHTML
                        ,itunesDuration: (xml.querySelector('itunes_duration') || defaultNode).innerHTML
                        ,itunesExplicit: (xml.querySelector('itunes_explicit') || defaultNode).innerHTML
                        ,enclosure: {
                            type: (xml.querySelector('enclosure') || defaultNode).getAttribute('type')
                            ,length: (xml.querySelector('enclosure') || defaultNode).getAttribute('length')
                            ,url: (xml.querySelector('enclosure') || defaultNode).getAttribute('url')
                        }
                    }
                })
        }

        // eslint-disable-next-line fp/no-mutation
        p.feedparsed = channel  

    }
}



const View = update => model =>
    m(
        'div'
        , m('input'
            , { oninput: 
                m.withAttr('value', function(value){
                    update({
                        type: 'UPDATE_FEED_VALUE'
                        ,value
                    })
                })
                ,value: model.feedurl
            }
        )
        , m('button', {
            onclick(){
                update({
                    type: 'FETCH_FEED'
                })
            }
        }, 'Fetch')
        , model.feedparsed
        && [
            m('a', { href: model.feedparsed.link }
                ,m('h1', model.feedparsed.title)
            )
            ,m('img', { 
                src: model.feedparsed.itunesImageHref
                ,style: { maxWidth: '100px' }
            })
            ,m('subheading', model.feedparsed.description)
            ,model.feedparsed.items.map(function(item){
                return [
                    m('heading', item.title)
                    ,m('subheading', item.itunesSubtitle)
                    ,m('p', item.description)
                    ,m('audio'
                        ,{ controls: 'controls'  
                        }
                        ,m('source', {
                            src: item.enclosure.url
                        })
                    )

                ]
            })
            ,m('pre', JSON.stringify(model.feedparsed, null, 2))
        ]
    )

function Component(actions$, update, initialModel){
        
    return Model(
        DOMSideEffects
        , initialModel
        , actions$
    )
    .map( View(update) )
}

const actions$ = stream()

Component( 
    actions$
    , actions$
    ,{ feedurl: 'https://feeds.feedburner.com/InterceptedWithJeremyScahill'
    , feedraw: null
    , feedparsed: null 
    } 
)
    // eslint-disable-next-line no-undef
    .map( x => m.render(document.body, x) )
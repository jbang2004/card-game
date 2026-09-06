import hashlib
"""Touch-layout regressions with Chromium touch emulation, not physical phones.
Tests load the standalone HTML via set_content with an explicit memory storage
adapter. External requests are blocked to validate offline mobile presentation.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, shutil, time, traceback, sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests'/'pocket';OUT.mkdir(exist_ok=True)
HTML=(ROOT/'index.html').read_text()
checks=[];all_errors=[];metrics={};page=None

def report(text):
    checks.append(text);print('PASS',len(checks),text,flush=True)
def state(page):return page.evaluate('JSON.stringify(Emberfall.game.s)')
def idle(page,extra=50):
    page.wait_for_function('!EmberFX.busy',timeout=20000);page.wait_for_timeout(extra)
def demo(page):
    page.evaluate('Emberfall.demo()');idle(page,120)
def inject(page,js):
    idle(page);page.evaluate('(()=>{const g=Emberfall.game;'+js+';g.emit()})()');idle(page)
def rect(page,sel):return page.locator(sel).bounding_box()
def center(page,sel):
    r=rect(page,sel);return (r['x']+r['width']/2,r['y']+r['height']/2)
def in_bounds(r,w,h):return r and r['x']>=-1 and r['y']>=-1 and r['x']+r['width']<=w+1 and r['y']+r['height']<=h+1

def setup(browser,w=390,h=844,mobile=True):
    ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
    page=ctx.new_page();page.set_default_timeout(5500)
    page.on('pageerror',lambda e:all_errors.append(str(e)))
    page.route('https://**/*',lambda q:q.abort())
    page.evaluate("window.__storage={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__storage[k]??null,setItem:(k,v)=>window.__storage[k]=String(v),removeItem:k=>delete window.__storage[k]}})")
    page.set_content(HTML,wait_until='domcontentloaded');page.wait_for_timeout(400)
    return ctx,page

def hold(page,selector):
    x,y=center(page,selector);cdp=page.context.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1,'radiusX':2,'radiusY':2}]})
    page.wait_for_timeout(505)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(80);cdp.detach()
def swipe(page,x1,y1,x2,y2):
    cdp=page.context.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x1,'y':y1,'id':1,'radiusX':2,'radiusY':2}]})
    for i in range(1,13):
        cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x1+(x2-x1)*i/12,'y':y1+(y2-y1)*i/12,'id':1,'radiusX':2,'radiusY':2}]});page.wait_for_timeout(16)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(450);cdp.detach()

def card_play(page,cid,target=None):
    page.locator(f'#hand [data-cardid="{cid}"]').first.tap();page.locator('#touch-card-play').tap()
    if target:page.locator(target).first.tap()
    idle(page)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        ctx,page=setup(browser)
        assert page.evaluate('EmberViewport.mobile && EmberViewport.portrait && EmberViewport.width===390')
        assert rect(page,'#app')['width']==390
        assert in_bounds(rect(page,'#quick-btn'),390,844)
        page.screenshot(path=str(OUT/'portrait-lobby.png'))
        report('Portrait lobby uses native CSS pixels, with reachable primary actions and no desktop letterboxing')
        page.locator('#quick-btn').tap();idle(page)
        for sel in ['#power-btn','#end-turn','#touch-menu','#touch-collection']:
            r=rect(page,sel);assert in_bounds(r,390,844) and r['height']>=44,(sel,r)
        report('Portrait hero power, end-turn, menu and collection buttons have at least 44 CSS-pixel height')
        before=state(page);page.locator('#hand [data-cardid="frostbolt"]').tap()
        assert page.evaluate("Emberfall.modal==='touch-card'") and state(page)==before
        assert page.locator('.touch-rule').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>=15
        assert in_bounds(rect(page,'#touch-card-play'),390,844)
        page.screenshot(path=str(OUT/'portrait-card-detail.png'))
        report('Tapping a hand card opens readable details and a separate play confirmation without spending resources')
        page.locator('#touch-card-cancel').tap();assert state(page)==before and page.evaluate('Emberfall.modal===null')
        report('Dismissing card details leaves hand, mana, board and RNG state unchanged')
        page.locator('#hand [data-cardid="frostbolt"]').tap();page.locator('#touch-card-play').tap()
        assert page.evaluate("Emberfall.selection.type==='card'") and state(page)==before
        assert page.locator('#touch-target-bar').is_visible()
        assert page.locator('#battle .valid-target').count()>0
        page.locator('#touch-cancel').tap();assert state(page)==before and page.evaluate('Emberfall.selection===null')
        report('Target choice has an explicit touch cancel; cancelling does not consume the selected spell')
        page.locator('#hand [data-cardid="frostbolt"]').tap();page.locator('#touch-card-play').tap();page.locator('#battle .minion.enemy[data-cardid="golem"]').tap()
        assert page.evaluate('EmberFX.busy && Emberfall.game.s.p.mana===4')
        snapshot=state(page);page.locator('#end-turn').tap(force=True);assert state(page)==snapshot
        idle(page)
        assert page.locator('#battle .minion.enemy.frozen').count()==1
        report('Actual touch-cast frost spell freezes its target; repeated input during animation cannot spend twice or skip turns')
        page.locator('#battle .minion.friendly[data-cardid="guard"]').tap()
        line=page.evaluate("(()=>{const path=document.getElementById('target-path');const a=path.getPointAtLength(0),b=path.getPointAtLength(1),z=path.getPointAtLength(path.getTotalLength());return {a:{x:a.x,y:a.y},b:{x:b.x,y:b.y},z:{x:z.x,y:z.y},dot:(b.x-a.x)*(z.x-a.x)+(b.y-a.y)*(z.y-a.y)}})()")
        assert line['dot']>0 and line['z']['y']<line['a']['y']
        pos=page.evaluate("EmberFX.pos(document.querySelector('#battle .minion.friendly[data-cardid=guard]'))")
        assert abs(pos['x']-line['a']['x'])<1 and abs(pos['y']-line['a']['y'])<1
        metrics['portraitAim']=line
        report('Aim origin matches the visible attacker and the initial curve tangent points towards the legal enemy target')
        page.locator('#battle .minion.enemy[data-cardid="golem"]').tap();idle(page,180)
        assert page.evaluate('Emberfall.game.s.e.board.length===2 && Emberfall.game.s.p.board[0].hp===1')
        assert page.locator('.death-ghost').count()==0
        report('Touch melee performs simultaneous damage, removes a lethal target and cleans up lunge/death clones')
        demo(page);before=state(page)
        hold(page,'#battle .minion.friendly[data-cardid="guard"]')
        assert page.evaluate("Emberfall.modal==='touch-card'") and state(page)==before
        page.locator('#touch-unit-close').tap();assert page.evaluate('Emberfall.modal===null')
        report('Long-press minion inspection does not attack; its first close tap is not swallowed by click suppression')
        before=state(page);hold(page,'#player-hero')
        assert page.evaluate("Emberfall.modal==='touch-hero'") and state(page)==before
        page.locator('#touch-hero-close').tap()
        report('Hero long-press opens current health, armor and skill details without changing game state')
        demo(page)
        page.locator('#power-btn').tap();page.locator('#enemy-hero').tap();idle(page)
        assert page.evaluate('Emberfall.game.s.p.powerUsed && Emberfall.game.s.p.mana===4 && Emberfall.game.s.e.armor===2')
        report('Native touch hero-power targeting uses the original cost, once-per-turn limit and enemy armor rules')
        demo(page);card_play(page,'phoenix')
        assert page.evaluate("Emberfall.game.s.p.board.some(m=>m.cid==='phoenix') && Emberfall.game.s.p.mana===2")
        report('Untargeted minion summon requires confirmation, then places the unit on the correct mobile lane')
        # A ten-card controlled fixture tests the mobile scroll contract.
        demo(page)
        inject(page,"g.s.p.mana=g.s.p.maxMana=10;g.s.p.hand=['frostbolt','phoenix','wisdom','sunblade','discovery','fireball','frostbolt','phoenix','wisdom','bolt'].map(id=>g.card(id))")
        before=state(page);r=rect(page,'#hand')
        swipe(page,r['x']+r['width']-25,r['y']+40,r['x']+20,r['y']+40)
        handscroll=page.locator('#hand').evaluate('e=>e.scrollLeft')
        assert handscroll>100 and state(page)==before and page.evaluate('Emberfall.modal===null && Emberfall.selection===null'),handscroll
        report('Native horizontal touch scrolling exposes a full ten-card hand without opening a card or triggering a drag/play')
        last=page.locator('#hand .hand-card').last;last.tap();assert page.locator('.touch-card-sheet h2').inner_text()=='星火箭'
        page.locator('#touch-card-cancel').tap()
        assert page.locator('#hand').evaluate('e=>e.scrollLeft')>100
        report('The last card of a full hand is reachable, and closing its details preserves the hand scroll position')
        before=state(page);page.locator('#touch-hand-all').tap()
        assert page.locator('.touch-hand-grid button').count()==10 and state(page)==before
        page.locator('.modal-close').tap()
        report('The full-hand overview exposes all ten cards at a larger size without altering the match')
        demo(page);page.evaluate('Emberfall.settings.fast=true')
        page.locator('#end-turn').tap();page.wait_for_function("Emberfall.game.s.active==='p' && Emberfall.game.s.turn===7 && !EmberFX.busy",timeout=45000)
        report('Ending a turn via touch runs real enemy AI actions and returns control to the player exactly once')
        # Mid-flight rotation: preserve rule state and finish the presentation callback once.
        demo(page);page.locator('#hand [data-cardid="frostbolt"]').tap();page.locator('#touch-card-play').tap();page.locator('#battle .minion.enemy[data-cardid="golem"]').tap()
        snap=state(page);page.set_viewport_size({'width':844,'height':390});idle(page,250)
        assert state(page)==snap and page.evaluate('!EmberViewport.portrait && EmberViewport.mobile')
        assert page.locator('.death-ghost,.cast-card').count()==0
        assert page.eval_on_selector_all('#battle .hero,#battle .minion','els=>els.every(e=>getComputedStyle(e).visibility!=="hidden")')
        report('Rotating during an attack/spell flushes one pending presentation commit, preserves state and releases the input lock')
        # Portrait -> landscape -> portrait, no reset or offscreen real controls.
        for w,h in [(844,390),(390,844)]:
            before=state(page);page.set_viewport_size({'width':w,'height':h});idle(page,130)
            assert state(page)==before
            for sel in ['#end-turn','#power-btn','#player-hero','#enemy-hero']:
                assert in_bounds(rect(page,sel),w,h),(sel,w,h,rect(page,sel))
            assert page.evaluate('document.getElementById("app").scrollTop===0')
        report('Repeated portrait/landscape switching keeps the same battle and all primary control hit boxes inside the viewport')
        ctx.close()

        # A normal campaign start uses UI taps (not the demo fixture).
        ctx,page=setup(browser)
        page.locator('#start-btn').tap();assert page.locator('[data-hero]').count()==3
        page.screenshot(path=str(OUT/'portrait-heroes.png'))
        page.locator('[data-hero="paladin"]').tap();page.locator('#hero-confirm').tap()
        assert page.evaluate("Emberfall.game.s.heroId==='paladin' && Emberfall.modal==='mulligan'")
        page.locator('[data-mulligan]').first.tap();assert page.locator('.mulligan-card.replace').count()==1
        page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(150)
        assert page.evaluate("Emberfall.modal==='mulligan'") and page.locator('.mulligan-card.replace').count()==1
        page.locator('#mulligan-confirm').tap();idle(page)
        assert page.evaluate("Emberfall.game.s.phase==='battle' && Emberfall.game.s.active==='p'")
        report('Normal campaign hero choice, selected mulligan replacement and confirmation survive rotation and start a real first turn')
        # Three normal turns through touch UI, choosing only legal visible-player actions.
        page.evaluate('Emberfall.settings.fast=true')
        played=0
        for _ in range(3):
            idle(page)
            choices=page.evaluate("(()=>{const g=Emberfall.game;return g.s.p.hand.filter(v=>!g.legalCard('p',v.uid)).map(v=>({cid:v.cid,target:EmberData.byId[v.cid].target}))})()")
            if choices:
                c=choices[0];page.locator(f'#hand [data-cardid="{c["cid"]}"]').first.tap();page.locator('#touch-card-play').tap()
                if page.evaluate('!!Emberfall.selection'):
                    page.locator('#battle .valid-target').first.tap()
                idle(page);played+=1
            turn=page.evaluate('Emberfall.game.s.turn');page.locator('#end-turn').tap()
            page.wait_for_function(f"Emberfall.game.s.active==='p' && Emberfall.game.s.turn==={turn+1} && !EmberFX.busy",timeout=40000)
        assert page.evaluate('Emberfall.game.s.turn')==4
        metrics['normalCampaign']={'turnsAdvanced':3,'cardsPlayedViaTouch':played,'hero':'paladin'}
        report('Three normal campaign turns advance using touch-confirmed cards and real enemy AI, without controlled damage or victory injection')
        # Save/restore route under the explicit memory adapter.
        before=state(page);page.locator('#touch-menu').tap();page.locator('[data-touch-menu="home"]').tap()
        page.locator('#start-btn').tap();idle(page)
        assert state(page)==before
        report('Returning to the tavern and resuming preserves a real campaign in the original save schema (memory adapter only)')
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
        page.locator('#touch-collection').tap();assert page.locator('.library-item').count()==48
        page.screenshot(path=str(OUT/'portrait-collection.png'))
        assert rect(page,'#touch-card-tab')['height']>=44
        page.locator('#touch-deck-tab').tap();page.locator('.deck-row').first.tap()
        assert page.locator('#deck-total').inner_text()=='29/30'
        page.locator('#touch-card-tab').tap()
        addable=page.locator('.library-item').evaluate_all("els=>els.find(e=>{let n=e.querySelector('.owned-count').textContent.split('/').map(Number);return n[0]<n[1]})?.dataset.add")
        page.locator(f'[data-add="{addable}"]').tap();page.locator('#touch-deck-tab').tap();assert page.locator('#deck-total').inner_text()=='30/30'
        page.locator('#deck-save').tap();assert page.evaluate("JSON.parse(window.__storage['emberfall.deck.v1']).length===30")
        page.locator('#touch-card-tab').tap()
        report('Mobile collection/deck tabs support removing, adding and saving a valid 30-card deck without changing the active match')
        before=state(page);hold(page,'.library-item:first-child')
        assert page.locator('.touch-inline-detail').count()==1 and state(page)==before
        page.locator('#touch-inline-close').tap();assert page.locator('.library-item').count()==48
        assert page.locator('#deck-total').inner_text()=='30/30'
        report('Long-press collection details return to the same unsaved editor without adding a card or discarding edits')
        page.locator('#library-search').fill('寒霜');assert page.locator('.library-item').count()>0
        page.set_viewport_size({'width':390,'height':480});page.wait_for_timeout(150)
        assert page.locator('#library-search').input_value()=='寒霜'
        assert in_bounds(rect(page,'#library-search'),390,480)
        assert page.locator('#library-search').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')==16
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100);page.locator('.modal-close').tap()
        report('Search text and native-sized input survive a reduced visible viewport (keyboard-size resize simulation)')
        # Mobile map, log, help, gallery and lab routes.
        for key,selector in [('map','.map-stop'),('journal','.touch-log'),('guide','.help-section'),('gallery','.atelier-vignette'),('boss','.touch-hero-info')]:
            page.locator('#touch-menu').tap();page.locator(f'[data-touch-menu="{key}"]').tap()
            assert page.locator(selector).count()>0
            assert in_bounds(rect(page,'.modal-close'),390,844)
            page.locator('.modal-close').tap()
        report('Adventure map, journal, rules, gallery and boss details remain reachable through the compact touch menu')
        page.locator('#touch-menu').tap();page.locator('[data-touch-menu="lab"]').tap();idle(page,1500)
        for school in ['steel','fire','frost','arcane','nature','holy','shadow']:
            page.locator(f'[data-school="{school}"]').tap();idle(page,60)
        page.locator('.modal-close').tap()
        assert page.evaluate('!EmberFX.busy && EmberFX.particles===0')
        report('All seven effect-lab schools run at mobile coordinates and closing the lab clears timers and visual effects')
        demo(page);page.locator('#settings-btn').tap();page.locator('[data-setting="reduced"]').tap();page.locator('#settings-done').tap()
        card_play(page,'frostbolt','#battle .minion.enemy[data-cardid="golem"]')
        assert page.evaluate('EmberFX.particles===0 && !EmberFX.busy')
        page.locator('#settings-btn').tap();page.locator('[data-setting="reduced"]').tap();page.locator('#settings-done').tap()
        report('Reduced motion keeps touch actions and rule feedback while suppressing decorative particles')
        # Forced discovery is a controlled fixture (not a campaign balance test).
        demo(page);inject(page,"g.s.p.mana=g.s.p.maxMana=10;g.s.p.hand=[g.card('discovery')]")
        card_play(page,'discovery');assert page.locator('[data-discover]').count()==3
        page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(100)
        assert page.locator('[data-discover]').count()==3 and page.evaluate("Emberfall.modal==='discover'")
        page.locator('[data-discover]').first.tap();idle(page)
        assert page.evaluate('Emberfall.game.s.choice===null && Emberfall.game.s.p.hand.length===1')
        report('A pending discover choice survives rotation and touch selection grants exactly one card')
        ctx.close()

        # Responsive stress fixtures: seven minions per side, ten cards.
        sizes=[(320,568),(360,640),(390,844),(430,932),(568,320),(667,375),(844,390),(932,430),(768,1024),(1024,768)]
        responsive=[]
        for w,h in sizes:
            ctx,page=setup(browser,w,h);demo(page)
            inject(page,"g.s.p.mana=g.s.p.maxMana=10;g.s.p.hand=['fireball','frostbolt','phoenix','sunblade','discovery','fireball','frostbolt','phoenix','sunblade','discovery'].map(c=>g.card(c));for(const side of ['p','e']){while(g.s[side].board.length<7)g.summon(side,'guard');g.s[side].board.forEach(m=>m.sick=false)}")
            for sel in ['#end-turn','#power-btn','#player-hero','#enemy-hero','#touch-menu']:
                r=rect(page,sel);assert in_bounds(r,w,h),(w,h,sel,r)
                # Check unobscured center through the real DOM hit-test path.
                x,y=center(page,sel)
                assert page.evaluate("([x,y,s])=>!!document.elementFromPoint(x,y)?.closest(s)",[x,y,sel]),(w,h,sel,'covered')
            unitboxes=page.locator('#battle .minion[data-uid]').evaluate_all('els=>els.map(e=>e.getBoundingClientRect().toJSON())')
            assert len(unitboxes)==14 and all(in_bounds(b,w,h) for b in unitboxes)
            assert page.locator('#hand').evaluate('e=>e.scrollWidth>e.clientWidth')
            page.wait_for_timeout(150)
            if (w,h) in [(390,844),(844,390),(320,568)]:
                page.wait_for_timeout(3000);page.screenshot(path=str(OUT/f'full-{w}x{h}.png'))
            responsive.append({'width':w,'height':h,'minionWidth':min(b['width'] for b in unitboxes),'powerHeight':rect(page,'#power-btn')['height'],'endTurnHeight':rect(page,'#end-turn')['height']})
            ctx.close()
        metrics['responsive']=responsive
        report('Ten phone/tablet viewport sizes keep seven-versus-seven minions and unobscured primary controls in bounds; ten-card hands scroll')

        # Desktop input contract preserved.
        ctx,page=setup(browser,1600,940,False);page.locator('#quick-btn').click();idle(page,160)
        assert not page.evaluate('EmberViewport.mobile')
        before=page.evaluate('Emberfall.game.s.p.mana')
        page.locator('#hand [data-cardid="frostbolt"]').click();assert page.evaluate('Emberfall.modal===null')
        page.locator('#battle .minion.enemy[data-cardid="golem"]').click();idle(page)
        assert page.evaluate('Emberfall.game.s.p.mana')==before-2
        page.locator('#collection-nav').click();assert page.locator('.library-item').count()==48
        page.keyboard.press('Escape');demo(page);page.wait_for_timeout(3000)
        page.screenshot(path=str(OUT/'desktop-battle.png'))
        report('Desktop direct-click targeting and original collection workflow remain intact')
        ctx.close()
        # Final real browser screenshots at the native mobile layouts.
        for name,w,h in [('portrait',390,844),('landscape',844,390)]:
            ctx,page=setup(browser,w,h);page.locator('#quick-btn').tap();idle(page,3650)
            page.screenshot(path=str(OUT/f'{name}-battle-final.png'))
            page.locator('#hand [data-cardid="frostbolt"]').tap();page.wait_for_timeout(200)
            page.screenshot(path=str(OUT/f'{name}-card-final.png'))
            ctx.close()
        assert not all_errors,all_errors
        report('No JavaScript page errors occurred in the executed desktop and touch-emulation checks')
    except Exception as exc:
        if page and not page.is_closed():
            page.screenshot(path=str(OUT/'failure.png'))
        (OUT/'browser-results.json').write_text(json.dumps({'status':'failed','checks':checks,'count':len(checks),'metrics':metrics,'errors':all_errors,'exception':str(exc)},ensure_ascii=False,indent=2))
        traceback.print_exc();browser.close();sys.exit(1)
    browser.close()
(OUT/'browser-results.json').write_text(json.dumps({'status':'passed','testedHTMLsha256':hashlib.sha256(HTML.encode()).hexdigest(),'checks':checks,'count':len(checks),'metrics':metrics,'errors':all_errors,
    'rendering':'Mobile Canvas / desktop 2D fallback; network deliberately blocked',
    'input':'Chromium is_mobile + has_touch + CDP native touch gestures; not physical phone hardware',
    'storage':'Explicit in-memory localStorage adapter. Real HTTP/file persistence not validated.',
    'campaign':'Three normal paladin campaign turns via touch; full hand/board and discovery use controlled fixtures'},ensure_ascii=False,indent=2))
print('DONE',len(checks),'checks',flush=True)
